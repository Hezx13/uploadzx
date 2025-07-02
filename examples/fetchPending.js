import Uploadzx from '../dist/index.mjs'

async function fetchPending() {
    const uploadQueue = new Uploadzx({
        endpoint: 'https://tusd.tusdemo.net/files/',
        maxConcurrent: 2,
        chunkSize: 1024 * 512,
    });
    const fileHandles = await uploadQueue.fileHandleStore.getAllFileHandles();
    console.log("fileHandles", fileHandles);
    return fileHandles;
}

fetchPending();