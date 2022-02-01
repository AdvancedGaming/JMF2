import { readFile, writeFile } from "fs/promises";

export type BotConfig = {
    botToken: string,
    guildId: string,
    adminChannelId: string,
    moderatorRoleId: string,
    tradingChannelId: string,
    coinFlipChannelId: string,
    commandsChannelId: string,
    giveawayPingRoleId: string,
    appCheckToken: string,
    madfutEmail: string,
    madfutPassword: string,
    shoppySecret: string,
    shopLogChannelId: string
}

const config: BotConfig = JSON.parse((await readFile("config.json")).toString());

function saveConfig() {
    return writeFile("config.json", JSON.stringify(config));
}

export default config;

export { saveConfig }