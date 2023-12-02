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
const fs = require('node:fs')
const admin = require('firebase-admin');
var serviceAccount = require("../../project-x-92081-6c41507a6aa7.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.http('courses-create', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    path: "courses/create",
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

            let token = request.headers.get("authorization");

            if (file && token) {
                token = token.split(" ")[1].trim();
                try {
                    let user = await admin.auth().verifyIdToken(token)
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
                            user_uid: user.uid
                        }
                    });

                    res = {
                        success: true,
                        name: blobName,
                        originalFileName: file.name,
                        type: file.type,
                        length: file.size
                    }
                } catch (err) {
                    if (err) {
                        console.error(err);
                        res = {
                            success: false,
                            error: "Forbidden"
                        }
                        status = 403;
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