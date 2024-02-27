const {
    app
} = require('@azure/functions');
const {
    BlobServiceClient
} = require("@azure/storage-blob")
require('dotenv').config({
    path: ".env"
});
const {
    MongoClient
} = require('mongodb');
const admin = require('firebase-admin');

async function deleteBlobIfItExists(blobName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    const container = process.env.AZURE_STORAGE_CONTAINER_NAME;
    const containerClient = blobServiceClient.getContainerClient(container);

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists({
        deleteSnapshots: "include"
    });
    console.log(`deleted blob ${blobName}`);
}

async function deleteCourse(course_id, user) {
    const client = new MongoClient(process.env.MONGO_CONNECTION_URL)
    const namespace = process.env.MONGO_NAMESPACE;
    const [dbName, ] = namespace.split(".");
    await client.connect();
    console.log("Connected successfully to Cosmos DB")
    const db = client.db(dbName)
    const courseCollection = db.collection("courses");
    const documentsOcrCollection = db.collection("documents-ocr")
    const documentsCollection = db.collection("documents")
    const session = client.startSession();
    try {
        session.startTransaction();
        let courses = await documentsOcrCollection.find({
            "course.id": course_id
        }, {
            session
        }).toArray() || [];

        // Deleting all the blobs
        await Promise.all(courses.map(async course => {
            await deleteBlobIfItExists(course.blob.name)
        }))

        // Deleting all the embeddings
        await documentsCollection.deleteMany({
            user: user,
            course: course_id
        }, {
            session
        }).then(res => console.log(`Deleted ${res.deletedCount} documents`));

        // Deleting the original documents stored after OCR
        await documentsOcrCollection.deleteMany({
            user: user,
            "course.id": course_id
        }, {
            session
        }).then(res => console.log(`Deleted ${res.deletedCount} documents`));

        // Deleting the Course Object
        await courseCollection.findOneAndDelete({
            author: user,
            "course.id": course_id
        }, {
            session
        }).then(res => console.log)

        // Commiting the Transaction
        await session.commitTransaction()
        console.log("Transaction committed successfully");
    } catch (err) {
        if (err) {
            console.error("Error during transaction:", err)
            await session.abortTransaction();
        }

        return false;
    } finally {
        await session.endSession()
        client.close();
    }
    return true
}

app.http('courses-delete', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: "courses/{id}",
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        let status = 200,
            res;
        let token = request.headers.get("Authorization");
        const course_id = request.params.id;

        if (token && course_id) {
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

                res = {
                    success: await deleteCourse(course_id, user.uid)
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
});