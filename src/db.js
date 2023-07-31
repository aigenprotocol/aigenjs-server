import 'dotenv/config'
import {QueryTypes, Sequelize} from "sequelize";

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DATABASE_PATH
});

export async function createAIProjectDB(projectId, projectName) {
    const [results, metadata] = await sequelize.query(`INSERT INTO aiproject (id, name) VALUES (${projectId}, '${projectName}')`, {
        type: QueryTypes.INSERT
    })
    return results
}

export async function updateAIProjectDB(projectId, values) {
    let valuesStr = []
    for (const key in values) {
        if (typeof values[key] === "string") {
            valuesStr.push(`${key}='${values[key]}'`)
        } else {
            valuesStr.push(`${key}=${values[key]}`)
        }
    }

    const [results, metadata] = await sequelize.query(`UPDATE aiproject SET ${valuesStr.join(",")} WHERE id='${projectId}'`, {
        type: QueryTypes.INSERT
    })
    return results
}

export async function createAINFTDB(filename, project_id, job_id) {
    const [results, metadata] = await sequelize.query(`INSERT INTO ainft (filename, project_id, job_id) values ('${filename}', ${project_id}, ${job_id})`, {
        type: QueryTypes.INSERT
    })
    return results
}

export async function getAINFTByProjectIdDB(projectId) {
    return await sequelize.query(`SELECT * FROM ainft WHERE project_id=${projectId}`, {
        type: QueryTypes.SELECT
    });
}

export async function getAINFTByFilenameDB(fileName) {
    return await sequelize.query(`SELECT * FROM ainft WHERE filename='${fileName}'`, {
        type: QueryTypes.SELECT
    });
}

export async function getAIProjectDB(projectId) {
    return await sequelize.query(`SELECT * FROM aiproject WHERE id=${projectId}`, {
        type: QueryTypes.SELECT
    });
}

export async function updateAINFTTokenIdDB(fileName, projectId, tokenId) {
    const [results, metadata] = await sequelize.query(`UPDATE ainft SET token_id=${tokenId} WHERE filename='${fileName}'`, {
        type: QueryTypes.INSERT
    })
    return results
}

export async function updateAINFTJobIdDB(id, jobId) {
    const [results, metadata] = await sequelize.query(`UPDATE ainft SET job_id=${jobId} WHERE id='${id}'`, {
        type: QueryTypes.INSERT
    })
    return results
}
