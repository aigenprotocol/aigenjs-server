import 'dotenv/config'

import express from "express";
import bodyParser from "body-parser";
import multer from 'multer'
import cors from "cors";
import fs from "fs/promises";
import fs1 from "fs";
import path from "path";
import {createAINFT} from "aigenjs/src/create_ainfts.js";
import {slugify} from "aigenjs/src/utils.js";
import {createAIProject} from "aigenjs/src/create_aiproject.js";

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });
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

app.post('/project/create',
    upload.fields([{name: "logoFile", maxCount: 1}, {name: "bannerFile", maxCount: 1}]),
    async (req, res, next) => {
    //console.log(req.body, req.files);
    const projectName = req.body.project_name;
    const projectDescription = req.body.project_description;

    if(projectName === undefined ){
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

app.post('/project/ainft_create', async (req, res) => {
    console.log(req.body);
    const projectId = req.body.project_id;
    const projectName = req.body.project_name;

    if (projectId === undefined || projectName === undefined) {
        res.send({"status": "failure", "message": "Project id or name missing"})
    }

    let final_name = slugify(projectName) + "_" + projectId;
    let ainft_results = await createAINFT(final_name, path.join(process.env.PROJECTS_DIR, final_name), projectId)
    console.log(ainft_results)

    res.send({"status": "success", "message": "NFT creation started"})
})

// Saving and loading w3name Keys
app.post('/saveSigningKey', async (req, res) => {
    const {keys, projectId, projectName} = req.body;
    console.log("Keys:", projectId, projectName, keys)

    // create project directory
    let project_dir = path.join(PROJECTS_DIR, projectName + "_" + projectId)
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

app.post('/loadSigningKey', async (req, res) => {
    const projectId = req.body.projectId;
    const projectName = req.body.projectName;
    let project_dir = path.join(PROJECTS_DIR, projectName + "_" + projectId)
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
