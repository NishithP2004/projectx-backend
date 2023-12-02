const { app } = require('@azure/functions');
const { GooglePaLM } = require('langchain/llms/googlepalm')

async function createQuiz(transcript) {
    try {
        const model = new GooglePaLM({
            apiKey: process.env.GOOGLE_PALM_API_KEY,
            temperature: 0.2,
            modelName: "models/text-bison-001",
            maxOutputTokens: 1024,
            candidate_count: 1,
            top_k: 40,
            top_p: 0.95
        })

        const prompt = `
        SYSTEM: You are an expert at reading YouTube video transcripts and generating quizzes on the same.
                When provided with the transcript of a YouTube video, you can generate a question with four options based on the input(transcript).
                Out of the 4 options, only one is the correct answer, the others may or may not be related terms.
                The idea is to test the user's understanding of a given subject matter and the user must be able to infer the answer from the video/transcript.
                Ensure the authenticity of the questions generated.
                Return the question in the following format as plain text:
                {
                    "question": "...",
                    "options": [
                        option1,
                        option2,
                        ...
                    ],
                    "key": correctAnswerIndex
                }
        INPUT: ${transcript}
        `
        let res = await model.call(prompt);
        console.log(res)
        
        return JSON.parse(res);
    } catch(err) {
        if(err) {
            console.error(err);
            return null;
        }
    }
}

app.http('quiz', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        if(request.method == "GET") {
            return {
                body: JSON.stringify({
                    message: "Hello World"
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        } else {
            let transcript = (await request.json()).transcript;
            let status, res;

            if(transcript) {
                res = {
                    success: true,
                    quiz: await createQuiz(transcript)
                }
                status = 200;
            } else {
                res = {
                    error: "Bad Request",
                    success: false
                }
                status = 400;
            }

            return {
                body: JSON.stringify(res),
                status,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});
