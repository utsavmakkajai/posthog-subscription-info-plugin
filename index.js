import { Plugin, PluginEvent, PluginMeta } from '@posthog/plugin-scaffold'
import { Client, QueryResult, QueryResultRow } from 'pg'


// Plugin method that runs on plugin load
export async function setupPlugin({ config }) {
    const requiredConfigOptions = ['clusterHost', 'clusterPort', 'dbName', 'dbUsername', 'dbPassword']
    for (const option of requiredConfigOptions) {
        if (!(option in config)) {
            throw new Error(`Required config option ${option} is missing!`)
        }
    }

    if (!config.clusterHost.endsWith('redshift.amazonaws.com')) {
        throw new Error('Cluster host must be a valid AWS Redshift host')
    }

    const totalRowsResult = await executeQuery(
        `SELECT COUNT(1) FROM ${sanitizeSqlIdentifier(config.tableName)}`,
        [],
        config
    )

    if (!totalRowsResult || totalRowsResult.error || !totalRowsResult.queryResult) {
        throw new Error('Unable to connect to Redshift!')
    }
}

// Plugin method that processes event
export async function processEvent(event, { config, cache }) {
    console.log(event)
    return event
}

const executeQuery = async (query,values,config) => {
    const pgClient = new Client({
        user: config.dbUsername,
        password: config.dbPassword,
        host: config.clusterHost,
        database: config.dbName,
        port: parseInt(config.clusterPort),
    })

    await pgClient.connect()

    let error = null
    let queryResult = null
    try {
        queryResult = await pgClient.query(query, values)
    } catch (err) {
        error = err
    }

    await pgClient.end()

    return { error, queryResult }
}