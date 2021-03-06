import { Plugin, PluginEvent, PluginMeta } from '@posthog/plugin-scaffold'
import { Client, QueryResult, QueryResultRow } from 'pg'


const sanitizeSqlIdentifier = (unquotedIdentifier) => {
    return unquotedIdentifier.replace(/[^\w\d_.]+/g, '')
}

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
        config
    )
    console.log(totalRowsResult)

    if (!totalRowsResult || totalRowsResult.error || !totalRowsResult.queryResult) {
        throw new Error('Unable to connect to Redshift!')
    }
}

// Plugin method that processes event
export async function processEvent(event, { config }) {
    let analyticsId = event['distinct_id']
    console.log(`Checking ${analyticsId} for user props`)
    if(analyticsId) {
        let query = `SELECT * FROM ${sanitizeSqlIdentifier(config.tableName)} WHERE analytics_id = '${analyticsId}' ORDER BY purchase_date desc`
        console.log(query)
        const response = await executeQuery(query, config);
        if (!response || response.error || !response.queryResult || response.queryResult.rows.length < 1)
        {
            console.log(`Row Count ${response.queryResult.rows.length}`)
            console.log(`No Response!!! ${JSON.stringify(response)} ${response.error} ${JSON.stringify(response.queryResult)} ${response.queryResult.rowCount}`)
            return event
        }
        let userProps = {}
        console.log("############ FOUND RECORD ##################")
        console.log(response.queryResult.rows[0])
        for (const [colName, colValue] of Object.entries(response.queryResult.rows[0])) {
            switch(colName){
                case 'customer_type':
                    userProps['Customer_Type'] = colValue ?? ""
                    break
                case 'purchase_date':
                    userProps['Purchase_Date'] = colValue ?? ""
                    break
                case 'expires_date':
                    userProps['Expiry_Date'] = colValue ?? ""
                    break
                case 'transaction_id':
                    userProps['Transaction_Id'] = colValue ?? ""
                    break
                case 'product_id':
                    userProps['Product_Id'] = colValue ?? ""
                    break
                case 'environment':
                    userProps['Env'] = colValue ?? ""
                    break
                case 'app_code':
                    userProps['App_Code'] = colValue ?? ""
                    break 
                case 'auto_renew_status':
                    userProps['Auto_Renew_Status'] = colValue ?? ""
                    break   
            }
        }
        console.log(`User prop for ${analyticsId} is ${JSON.stringify(userProps)}`)
        event.properties[`$set`] = userProps
        console.log(JSON.stringify(event))
    }
    return event
}

async function executeQuery (query,config){
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
        queryResult = await pgClient.query(query)
    } catch (err) {
        error = err
    }

    await pgClient.end()

    return { error, queryResult }
}

module.exports = {
    setupPlugin,
    processEvent
}