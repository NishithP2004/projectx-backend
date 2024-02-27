const {
    app
} = require('@azure/functions');
const {
    GooglePaLM
} = require('langchain/llms/googlepalm')
const {
    ChatGoogleGenerativeAI
} = require("@langchain/google-genai")
const getDocumentContent = require('./courses-doc-content');
require('dotenv').config({
    path: ".env"
});
const admin = require('firebase-admin');

async function createQuiz(content, questions = 1) {
    try {
        const model = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_PALM_API_KEY,
            temperature: 0.2,
            modelName: "gemini-pro"
        })

        const prompt = `
        SYSTEM: You are an expert at reading YouTube video transcripts / Document Summaries and generating quizzes on the same.
                When provided with the transcript of a YouTube video or a Document Summary, you can generate a question with four options based on the input (transcript / summary).
                Out of the 4 options, only one or more options is the correct answer, the others may or may not be related terms.
                The idea is to test the user's understanding of a given subject matter and the user must be able to infer the answer from the video/transcript or document summary.
                Ensure the authenticity of the questions generated.
                Return the question in the following format as plain text:
                [
                {
                    "question": "...",
                    "answers": [
                        option1,
                        option2,
                        ...
                    ],
                    "answerSelectionType": "single|multiple",
                    "explaination": "...",
                    "correctAnswer": "correctAnswerIndex" || [array of correct answer indices] // [0, 1, 2]
                }
                ]   
        INPUT: ${content}

        Generate a set of ${questions} question(s) and return the same as an array of objects.
        `
        // let res = await model.call(prompt);
        let res = (await model.invoke([
            ["human", prompt]
        ])).content
        console.log(res)

        return JSON.parse(res);
    } catch (err) {
        if (err) {
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

        if (request.method == "GET") {
            return {
                body: JSON.stringify({
                    message: "Hello World"
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        } else {
            const body = await request.json();

            let token = request.headers.get("Authorization");
            let content = body.transcript || body.summary;
            let questions = body.questions || 1;
            let doc_id = body.doc_id;

            questions %= 11;

            let status = 200,
                res;

            if ((token && doc_id) || (token && content)) {
                token = token.split(" ")[1].trim();
                try {
                    let user = await admin.auth().verifyIdToken(token)
                        .catch(err => {
                            if (err) {
                                status = 403;
                                res = {
                                    success: false,
                                    error: "Forbidden"
                                }

                                return {
                                    body: JSON.stringify(res),
                                    status,
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                };
                            }
                        })
                    console.log(user.uid)

                    let doc;
                    if (doc_id)
                        doc = await getDocumentContent(doc_id, user.uid);

                    let quiz = await createQuiz(content || doc.summary || doc.content, Math.abs(questions));

                    res = {
                        success: true,
                        quiz: (questions === 1) ? quiz[0] : quiz
                    }
                } catch (err) {
                    if (err) {
                        res = {
                            success: false,
                            error: err.message
                        }
                        status = err.status || 500;
                    }
                }
            } else {
                res = {
                    success: false,
                    error: (!token) ? "Unauthorized" : "Bad Request"
                }
                status = (!token) ? 401 : 400;
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