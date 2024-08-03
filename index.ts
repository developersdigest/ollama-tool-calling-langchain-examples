//1. Import dependencies
import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";
const { exec } = require('child_process');

//2. Define weatherTool
const weatherTool = tool(async ({ latitude, longitude }) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error("Invalid latitude or longitude provided");
    }
    const params = {
        latitude: String(latitude),
        longitude: String(longitude),
        hourly: "temperature_2m",
        format: "json",
    };
    const url = "https://api.open-meteo.com/v1/forecast";
    const response = await fetch(url + "?" + new URLSearchParams(params));
    const data = await response.json();
    const parsedData = JSON.parse(JSON.stringify(data));
    const weatherData = parsedData.hourly.time.map((time: string, index: number) => ({
        time,
        temperature: parsedData.hourly.temperature_2m[index],
    }));
    const formattedData = JSON.stringify(weatherData);
    return `Weather data: ${formattedData}`;
}, {
    name: "get_current_weather",
    description: "Get the current weather for a given city",
    schema: z.object({
        latitude: z.number().describe("Latitude of the location"),
        longitude: z.number().describe("Longitude of the location"),
    }),
});

//3. Define calculatorTool
const calculatorTool = tool(() => {
    let command;
    console.log('Calculator tool called!');

    switch (process.platform) {
        case 'win32':
            command = 'start calc.exe';
            break;
        case 'darwin':
            command = 'open -a Calculator';
            break;
        case 'linux':
            command = 'gnome-calculator';
            break;
        default:
            console.log('Unsupported operating system');
            return "Unsupported operating system";
    }

    console.log('Opening calculator...');
    exec(command, (error: { message: any; }, stdout: any, stderr: any) => {
        if (error) {
            console.error(`Error opening calculator: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log('Calculator opened successfully');
    });
    return "Calculator app opened";
}, {
    name: "open_calculator",
    description: "Open the calculator app",
    schema: z.object({}).strict(),
});

//4. Define chromeTool
const chromeTool = tool(
    async ({ query }: { query: string }) => {
        let command;
        console.log('Chrome tool called!');

        switch (process.platform) {
            case 'win32':
                command = `start chrome "https://claude.ai/new?q=${encodeURIComponent(query)}"`;
                break;
            case 'darwin':
                command = `open -a "Google Chrome" "https://claude.ai/new?q=${encodeURIComponent(query)}"`;
                break;
            case 'linux':
                command = `google-chrome "https://claude.ai/new?q=${encodeURIComponent(query)}"`;
                break;
            default:
                console.log('Unsupported operating system');
                return "Unsupported operating system";
        }

        console.log('Opening Chrome with Claude AI...');
        exec(command, (error: { message: any; }, stdout: any, stderr: any) => {
            if (error) {
                console.error(`Error opening Chrome: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log('Chrome opened successfully with Claude AI');
        });
        return `Opened Chrome with Claude AI and query: ${query}`;
    },
    {
        name: "open_chrome_with_claude",
        description: "Open Google Chrome and navigate to Claude AI with a specific query",
        schema: z.object({
            query: z.string().describe("The query to ask Claude AI"),
        }),
    }
);

//5. Define the model and bind tools
const model = new ChatOllama({
    model: "llama3.1",
});

const modelWithTools = model.bindTools([weatherTool, calculatorTool, chromeTool]);

//6. Define main runExample function
async function runExample(query: string) {
    try {
        const result = await modelWithTools.invoke(query);

        console.log("Model response:", result);

        // Invoke the tools based on the model's response
        if (result.tool_calls && result.tool_calls.length > 0) {
            for (const toolCall of result.tool_calls) {
                try {
                    if (toolCall.name === "get_current_weather") {
                        const weatherResult = await weatherTool.invoke({
                            latitude: parseFloat(toolCall.args.latitude),
                            longitude: parseFloat(toolCall.args.longitude),
                        });
                        console.log("Weather tool result:", weatherResult);
                    } else if (toolCall.name === "open_calculator") {
                        const calculatorResult = await calculatorTool.invoke({});
                        console.log("Calculator tool result:", calculatorResult);
                    } else if (toolCall.name === "open_chrome_with_claude") {
                        const chromeResult = await chromeTool.invoke({
                            query: toolCall.args.query,
                        });
                        console.log("Chrome tool result:", chromeResult);
                    }
                } catch (toolError: unknown) {
                    if (toolError instanceof Error) {
                        console.error(`Error invoking ${toolCall.name}:`, toolError.message);
                    } else {
                        console.error(`Unknown error invoking ${toolCall.name}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in runExample:", error);
    }
}

//7. Run the example
runExample("What's the current weather in San Francisco? Also, can you open the calculator app? Lastly, open Chrome and ask Claude 'What is the capital of France?'").catch(console.error);