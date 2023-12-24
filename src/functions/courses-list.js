const {
    app
} = require('@azure/functions');
const {
    MongoClient
} = require('mongodb');

require('dotenv').config({
    path: ".env"
});

const admin = require('firebase-admin');
var serviceAccount = require("../../project-x-92081-6c41507a6aa7.json");

async function getCourses(user) {
    try {
        const client = new MongoClient(process.env.MONGO_CONNECTION_URL)
        const namespace = process.env.MONGO_NAMESPACE;
        const [dbName, ] = namespace.split(".");
        await client.connect();
        console.log("Connected successfully to Cosmos DB")
        const db = client.db(dbName)
        const collection = db.collection("courses");

        let courses = await collection.find({
            "author": user
        }).toArray() || [];

        return courses;
    } catch (err) {
        if (err) {
            console.error(err)
            return [];
        }
    }
}

app.http('courses-list', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "courses/list",
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        let status = 200,
            res;
        let token = request.headers.get("Authorization");
        if (token) {
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

                let courses = await getCourses(user.uid);
                res = {
                    success: true,
                    courses
                }
            } catch (err) {
                if (err) {
                    res = {
                        success: false,
                        error: err.message
                    }
                    status = 500;
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
});