import 'dotenv/config'
import Bull from "bull";
import {createAINFT} from "aigenjs/src/create_ainfts.js";
import {updateAINFTTokenIdDB} from "./db.js";

const aigenjsQueue = new Bull('aigenjs-queue');

//remove all tasks
//aigenjsQueue.empty()

aigenjsQueue.process(async (job) => {
    console.log(job.data)
    let singleMetadata = await createAINFT(job.data.fileName, job.data.dirPath);
    await updateAINFTTokenIdDB(job.data.fileName, job.data.projectId, singleMetadata.tokenId)
});
