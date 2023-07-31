import 'dotenv/config'

import express from "express";
import bodyParser from "body-parser";
import multer from 'multer'
import cors from "cors";
import fs from "fs/promises";
import fs_promises from "fs/promises";
import fs1 from "fs";
import path from "path";
import {slugify} from "aigenjs/src/utils.js";
import {createAIProject} from "aigenjs/src/create_aiproject.js";
import Bull from 'bull'
import {
    createAINFTDB,
    createAIProjectDB,
    getAINFTByFilenameDB,
    getAINFTByProjectIdDB,
    getAIProjectDB,
    updateAINFTJobIdDB,
    updateAIProjectDB
} from "./db.js";
import {getAINFTByProjectId, linkAINFTToProject} from "aigenjs/src/create_ainfts.js";

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({storage: storage});
const app = express()

app.use(cors())

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/xwww-
app.use(bodyParser.urlencoded({extended: true}));
//form-urlencoded

// for parsing multipart/form-data
// app.use(upload.array());
// app.use(express.static('public'));

const aigenjsQueue = new Bull('aigenjs-queue');

app.post('/project/create',
    upload.fields([{name: "logoFile", maxCount: 1}, {name: "bannerFile", maxCount: 1}]),
    async (req, res, next) => {
        //console.log(req.body, req.files);
        const projectName = req.body.project_name;
        const projectDescription = req.body.project_description;

        if (projectName === undefined) {
            return res.status(400).send('Project name is not provided.');
        }
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        let projectLogoPath = req.files.logoFile[0].path;
        let projectBannerPath = req.files.bannerFile[0].path;

        await createAIProject(projectName, projectDescription, projectLogoPath, projectBannerPath)

        res.send({"status": "success", "message": "NFT creation started"})
    })

app.post('/project/ainft/create', upload.none(), async (req, res) => {
    const projectId = req.body.project_id;
    const projectName = req.body.project_name;

    if (projectId === undefined || projectName === undefined) {
        res.send({"status": "failure", "message": "Project id or name missing"})
    }

    let final_name = slugify(projectName) + "_" + projectId;
    let projectDir = path.join(process.env.PROJECTS_DIR, final_name)
    let final_shards = path.join(projectDir, "final_shards")
    let fileNames = await fs_promises.readdir(final_shards);
    for (let i = 0; i < fileNames.length; i++) {
        const ainfts = await getAINFTByFilenameDB(fileNames[i])

        if (ainfts.length === 0) {
            const job = await aigenjsQueue.add({
                projectId: projectId,
                fileName: fileNames[i],
                dirPath: final_shards
            });

            // check and create a project in database
            const projects = await getAIProjectDB(projectId)
            if (projects.length === 0) {
                await createAIProjectDB(projectId, projectName)
            }

            await createAINFTDB(fileNames[i], projectId, job.id)
        } else {
            console.log("ainfts:", ainfts)
            let ainft = ainfts[0];
            let job = await aigenjsQueue.getJob(ainft.job_id);
            let status = await job.getState()

            if (status === "failed") {
                const job = await aigenjsQueue.add({
                    projectId: projectId,
                    fileName: fileNames[i],
                    dirPath: final_shards
                });

                await updateAINFTJobIdDB(ainft.id, job.id)
            } else {
                console.log("Job already computed")
            }
        }
    }

    res.send({"status": "success", "message": "NFT creation started"})
})

app.post('/project/ainft/status', upload.none(), async (req, res) => {
    const projectId = req.body.project_id;
    console.log("get ainift status:", projectId)
    const ainfts = await getAINFTByProjectIdDB(projectId)

    let allCompleted = 0;
    let tokenIds = [];
    let results = []
    for (let i = 0; i < ainfts.length; i++) {
        let job = await aigenjsQueue.getJob(ainfts[i].job_id);
        console.log("Job details:", ainfts[i].job_id, await job.getState())
        let status = await job.getState()
        results.push({
            projectId: ainfts[i].project_id,
            filename: ainfts[i].filename,
            ainftId: ainfts[i].id,
            status: status
        })

        if (status === "completed") {
            allCompleted += 1;
            tokenIds.push(ainfts[i].token_id)
        }
    }

    // link ainfts to project if all completed
    if (allCompleted === ainfts.length) {
        // trigger linking
        const aiProjects = await getAIProjectDB(projectId)
        const aiProject = aiProjects[0];

        if (aiProject.ainfts_linked === 0 || aiProject.ainfts_linked === null) {
            if (tokenIds.length > 0) {
                console.log("Token ids:", tokenIds, projectId)
                let event = await linkAINFTToProject(projectId, tokenIds)
                if (event !== null) {
                    await updateAIProjectDB(projectId, {ainfts_linked: true})
                    console.log("AINFTs linked")
                } else {
                    console.log("Error in linking ainfts")
                }
            } else {
                console.log("Nothing to link")
            }
        } else {
            console.log("NFTs already linked:", await getAINFTByProjectId(projectId))
        }
    }

    res.send({"status": "success", "results": results})
});

// Saving and loading w3name Keys
app.post('/saveSigningKey', upload.none(), async (req, res) => {
    const {keys, projectId, projectName} = req.body;
    console.log("Keys:", projectId, projectName, keys)

    // create project directory
    let project_dir = path.join(process.env.PROJECTS_DIR, slugify(projectName) + "_" + projectId)
    if (!fs1.existsSync(project_dir)) {
        fs1.mkdirSync(project_dir);
    }

    // save w3name signing keys
    let w3name_keys_filepath = path.join(project_dir, "w3name-keys.txt")
    try {
        await fs.writeFile(w3name_keys_filepath, keys);
        res.status(200).json({message: 'Signing key saved successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Failed to save signing key'});
    }
});

app.post('/loadSigningKey', upload.none(), async (req, res) => {
    const projectId = req.body.projectId;
    const projectName = req.body.projectName;
    let project_dir = path.join(process.env.PROJECTS_DIR, slugify(projectName) + "_" + projectId)
    let w3name_keys_filepath = path.join(project_dir, "w3name-keys.txt")
    try {
        const keys = JSON.parse((await fs.readFile(w3name_keys_filepath)).toString())
        res.status(200).json({keys});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Failed to load signing key'});
    }
});

app.listen(process.env.AIGENJS_SERVER_PORT, () => {
    console.log(`Aigenjs server is listening on port ${process.env.AIGENJS_SERVER_PORT}`)
})
