const {
    app
} = require('@azure/functions');
const {
    BlobServiceClient
} = require("@azure/storage-blob")
const crypto = require('node:crypto');
require('dotenv').config({
    path: ".env"
});
const admin = require('firebase-admin');
var serviceAccount = require("../../project-x-92081-6c41507a6aa7.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.http('courses-create', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: "courses/create",
    handler: async (request, context) => {
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
            let res = {},
                status = 200;
            let payload = await request.formData();
            let file = payload.get('file')

            let token = request.headers.get("Authorization");

            if (file && token) {
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
                    let bodyBuffer = Buffer.from(await file.arrayBuffer())
                    const blobName = crypto.randomUUID()

                    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
                    const container = process.env.AZURE_STORAGE_CONTAINER_NAME;
                    const containerClient = blobServiceClient.getContainerClient(container);

                    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

                    const uploadBlobResponse = await blockBlobClient.upload(Buffer.from(bodyBuffer), file.size, {
                        metadata: {
                            mimeType: file.type,
                            extension: file.name.substring(file.name.lastIndexOf(".")) || null,
                            user_uid: user.uid,
                            course_name: payload.get("course_name"),
                            course_id: payload.get("course_id") || crypto.randomBytes(4).toString("hex")
                        }
                    });

                    res = {
                        success: true,
                        file: {
                            name: blobName,
                            originalFileName: file.name,
                            type: file.type,
                            length: file.size
                        }
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
    }
});