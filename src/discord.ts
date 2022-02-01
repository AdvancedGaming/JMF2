import Eris, { ApplicationCommandOptions, ApplicationCommandOptionsSubCommand, ApplicationCommandOptionsSubCommandGroup, CommandInteraction, ComponentInteraction, Constants, InteractionDataOptionsBoolean, InteractionDataOptionsInteger, InteractionDataOptionsString, InteractionDataOptionsSubCommand, InteractionDataOptionsUser } from "eris";
import { once, EventEmitter } from "events";
import { readFileFromURL } from "./util.js";
import config, { BotConfig } from "./config.js";

const bot = Eris(config.botToken, {
    intents: ["guilds", "guildMessages"]
});

const permittedReacts: Record<string, string | boolean> = {};

interface BotEvents {
    link: [interaction: CommandInteraction, username: string];
    viewlink: [interaction: CommandInteraction];
    unlink: [interaction: ComponentInteraction];
    wallet: [interaction: CommandInteraction, page: number];
    deposit: [interaction: CommandInteraction, multiple: boolean];
    withdraw: [interaction: CommandInteraction, coins: number, cards: string[], packs: string[]];
    pay: [interaction: CommandInteraction, userId: string, coins: number, cards: string[], packs: string[]];
    trade: [interaction: CommandInteraction, userId: string, givingCoins: number, givingCards: string[], givingPacks: string[], receivingCoins: number, receivingCards: string[], receivingPacks: string[]];
    flip: [interaction: CommandInteraction, coins: number, heads: boolean, userId?: string];
    invme: [interaction: CommandInteraction, coins: number, packs?: string[]];
    updatenames: [interaction: CommandInteraction, names: [string, string, string, string, string][]];
    freetrade: [interaction: CommandInteraction, amount: number, username?: string, userId?: string];
    setpacks: [interaction: CommandInteraction, packs: string[]];
    giveawayjoin: [interaction: ComponentInteraction, userId: string];
    "ga-forcestart": [interaction: CommandInteraction];
    "ga-forcestop": [interaction: CommandInteraction];
    "ga-announce": [interaction: CommandInteraction, start: string, duration?: string];
    "end-transaction": [interaction: CommandInteraction, userId: string];
    lock: [interaction: CommandInteraction, reason: string];
    unlock: [interaction: CommandInteraction];
    rawquery: [interaction: CommandInteraction, rawQuery: string];
    "admin-pay": [interaction: CommandInteraction, userId: string, coins: number, cards: string[], packs: string[]];
    "withdraw-all": [interaction: CommandInteraction]
}

interface IDiscordBot extends EventEmitter {
    on<K extends keyof BotEvents>(event: K, listener: (...args: BotEvents[K]) => void): this;
    once<K extends keyof BotEvents>(event: K, listener: (...args: BotEvents[K]) => void): this;
    emit<K extends keyof BotEvents>(event: K, ...args: BotEvents[K]): boolean;

    setPermittedReact: (messageId: string, userId: string | boolean) => void;
    sendMessage(channelId: string, content: Eris.MessageContent): Promise<Eris.Message<Eris.TextableChannel>>
    editMessage(channelID: string, messageID: string, content: Eris.MessageContentEdit): Promise<Eris.Message<Eris.TextableChannel>>
    getReacts(message: Eris.Message<Eris.TextableChannel>, emoji: string): Promise<string[]>
    react(message: Eris.Message<Eris.TextableChannel>, emoji: string): Promise<void>

    config: BotConfig;
}

class DiscordBot extends EventEmitter {
    config: BotConfig;

    setPermittedReact(messageId: string, userId: string | boolean): void {
        permittedReacts[messageId] = userId;
    }
    constructor() {
        super();
        this.config = config;
    }

    sendMessage(channelId: string, content: Eris.MessageContent): Promise<Eris.Message<Eris.TextableChannel>> {
        return bot.createMessage(channelId, content);
    }

    editMessage(channelID: string, messageID: string, content: Eris.MessageContentEdit): Promise<Eris.Message<Eris.TextableChannel>> {
        return bot.editMessage(channelID, messageID, content);
    }

    getReacts(message: Eris.Message<Eris.TextableChannel>, emoji: string): Promise<string[]> {
        return new Promise(async (resolve) => {
            const res: string[] = [];
            let after: string | undefined;
            let added: number = 0;
            do {
                const users = await message.getReaction(emoji, after ? { after } : {});
                added = users.length;
                after = users[users.length - 1]?.id;
                res.push(...users.map(user => user.id));
            } while (added === 100);

            resolve(res);
        });
    }

    async react(message: Eris.Message<Eris.TextableChannel>, emoji: string): Promise<void> {
        return message.addReaction(emoji);
    }
}

const exportedBot: IDiscordBot = new DiscordBot() as IDiscordBot;

bot.on("error", (err) => {
    console.error("[DISCORD BOT ERROR]", err); // or your preferred logger
});


bot.connect();
await Promise.all([once(bot, "ready")]);

console.log("Discord connected");

// bot initialization start

bot.editStatus({
    name: "MADFUT",
    type: Constants.ActivityTypes.GAME,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
})

const linkCommand: ApplicationCommandOptionsSubCommand = {
    name: "link",
    description: "Links your Discord account to a MADFUT username",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "username",
            description: "The MADFUT username you want to link your Discord account to. Omit to view your link status.",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        }
    ]
}

const unlinkCommand: ApplicationCommandOptionsSubCommand = {
    name: "unlink",
    description: "Unlink your Discord account from the linked MADFUT username (if it is linked)",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
}

const updateNamesCommand: ApplicationCommandOptionsSubCommand = {
    name: "un",
    description: "[ADMIN] 🤫",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
}

const freeTradeCommand: ApplicationCommandOptionsSubCommand = {
    name: "ft",
    description: "[ADMIN] 🤫",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "a",
            description: "🤷",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: true
        },
        {
            name: "u",
            description: "🤷",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "du",
            description: "🤷",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: false
        }
    ]
}

const setPacksCommand: ApplicationCommandOptionsSubCommand = {
    name: "sp",
    description: "[ADMIN] 🤫",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "p",
            description: "🤷",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: true
        }
    ]
}

const walletCommand: ApplicationCommandOptionsSubCommand = {
    name: "wallet",
    description: "Display your Madfut Galore wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "page",
            description: "The page you want to display",
            type: Constants.ApplicationCommandOptionTypes.INTEGER
        }
    ]
}

const depositCommand: ApplicationCommandOptionsSubCommand = {
    name: "deposit",
    description: "Deposit cards, packs or coins into your wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "multiple",
            description: "Whether you want to make multiple deposits in one go",
            type: Constants.ApplicationCommandOptionTypes.BOOLEAN
        }
    ]
};

const withdrawAllCommand: ApplicationCommandOptionsSubCommand = {
    name: "withdraw-all",
    description: "Withdraw your entire wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
}

const withdrawCommand: ApplicationCommandOptionsSubCommand = {
    name: "withdraw",
    description: "Withdraw cards, packs or coins from your wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "coins",
            description: "The amount of coins to withdraw from your wallet",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        },
        {
            name: "cards",
            description: "A comma-separated list of cards to withdraw from your wallet",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "packs",
            description: "A comma-separated list of packs to withdraw from your wallet",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        }
    ]
};

const payCommand: ApplicationCommandOptionsSubCommand = {
    name: "pay",
    description: "Pay another user with cards, packs or coins from your wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "user",
            description: "The user you want to pay",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: true
        },
        {
            name: "coins",
            description: "The amount of coins to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        },
        {
            name: "cards",
            description: "A comma-separated list of cards to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "packs",
            description: "A comma-separated list of packs to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        }
    ]
}

const adminPayCommand: ApplicationCommandOptionsSubCommand = {
    name: "pay",
    description: "Put the specified cards, packs and coins into the specified user's wallet",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "user",
            description: "The user you want to pay",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: true
        },
        {
            name: "coins",
            description: "The amount of coins to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        },
        {
            name: "cards",
            description: "A comma-separated list of ⚠️IDs of cards⚠️ to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "packs",
            description: "A comma-separated list of ⚠️IDs of packs⚠️ to pay to the other user",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        }
    ]
}

const tradeCommand: ApplicationCommandOptionsSubCommand = {
    name: "trade",
    description: "Trade cards, packs or coins from your wallet with another user",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "user",
            description: "The user you want to trade with",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: true
        },
        {
            name: "givecoins",
            description: "The amount of coins you want to give",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        },
        {
            name: "givecards",
            description: "A comma-separated list of cards you want to give",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "givepacks",
            description: "A comma-separated list of packs you want to give",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "receivecoins",
            description: "The amount of coins you want to receive",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        },
        {
            name: "receivecards",
            description: "A comma-separated list of cards you want to receive",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "receivepacks",
            description: "A comma-separated list of packs you want to receive",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
    ]
}

const flipCommand: ApplicationCommandOptionsSubCommand = {
    name: "flip",
    description: "Flip a coin with another user for coins",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "coins",
            description: "The amount of coins you want to flip for",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: true
        },
        {
            name: "side",
            description: "The side you pick",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            choices: [
                {
                    name: "Heads",
                    value: "heads"
                },
                {
                    name: "Tails",
                    value: "tails"
                }
            ],
            required: true
        },
        {
            name: "user",
            description: "The user you want to flip with. Omit to flip with anyone who accepts.",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: false
        }
    ]
}

const invMeCommand: ApplicationCommandOptionsSubCommand = {
    name: "im",
    description: "[MODERATOR] 🤫",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "packs",
            description: "Packs to get, contact Madfut Galore for a list",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: false
        },
        {
            name: "coins",
            description: "Coins to get",
            type: Constants.ApplicationCommandOptionTypes.INTEGER,
            required: false
        }
    ]
}

const giveawayCommand: Eris.ApplicationCommandOptionsSubCommand[] = [
    {
        name: "ga-announce",
        description: "[ADMIN] Announce a giveaway",
        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
        options: [
            {
                name: "start",
                description: "When to start the giveaway (minutes, relative)",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: true
            },
            {
                name: "duration",
                description: "Duration of the giveaway (minutes)",
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false
            },
        ]
    },
    {
        name: "ga-forcestart",
        description: "[ADMIN] Force start a giveaway",
        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
    },
    {
        name: "ga-forcestop",
        description: "[ADMIN] Force stop a giveaway",
        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
    }
];

const forceEndTransactionCommand: ApplicationCommandOptionsSubCommand = {
    name: "force-end-transaction",
    description: "[MODERATOR] ⚠️ Force ends a user's transaction ⚠️",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "user",
            description: "The user for whom to end the transaction",
            type: Constants.ApplicationCommandOptionTypes.USER,
            required: true
        }
    ]
}

const lockCommand: ApplicationCommandOptionsSubCommand = {
    name: 'lock',
    description: "[ADMIN] Locks all trades",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "reason",
            description: "The reason to lock all trades",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: true
        }
    ]
};

const unlockCommand: ApplicationCommandOptionsSubCommand = {
    name: 'unlock',
    description: "[ADMIN] Unlocks all trades",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
};

const queryCommand: ApplicationCommandOptionsSubCommand = {
    name: 'q',
    description: "[ADMIN] 🤫",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
    options: [
        {
            name: "q",
            description: "[ADMIN] 🤷",
            type: Constants.ApplicationCommandOptionTypes.STRING,
            required: true
        }
    ]
}

const adminCommand: ApplicationCommandOptionsSubCommandGroup = {
    name: "admin",
    description: "[ADMIN] All admin commands",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
    options: [
        ...giveawayCommand,
        setPacksCommand,
        freeTradeCommand,
        updateNamesCommand,
        lockCommand,
        unlockCommand,
        queryCommand,
        adminPayCommand
    ]
}


const moderatorCommand: ApplicationCommandOptionsSubCommandGroup = {
    name: "moderator",
    description: "[MODERATOR] All moderator commands",
    type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
    options: [
        invMeCommand,
        forceEndTransactionCommand
    ]
}

const mainCommand: Eris.ApplicationCommandStructure = {
    name: "madfut",
    description: "The main MADFUT Madfut Galore bot command",
    options: [ //An array of Chat Input options https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure
        linkCommand,
        unlinkCommand,
        walletCommand,
        depositCommand,
        withdrawCommand,
        payCommand,
        tradeCommand,
        flipCommand,
        moderatorCommand,
        adminCommand,
        //withdrawAllCommand
    ],
    type: Constants.ApplicationCommandTypes.CHAT_INPUT
};

bot.createGuildCommand(config.guildId, mainCommand);

bot.createGuildCommand(config.guildId, {...mainCommand, name: "mf"});

async function confirm(interaction: CommandInteraction, id: string, message: string) {
    await interaction.createMessage({
        content: message,
        components: [
            {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: [
                    {
                        custom_id: id,
                        type: Constants.ComponentTypes.BUTTON,
                        style: Constants.ButtonStyles.DANGER,
                        label: "Confirm"
                    }
                ]
            }
        ],
        flags: Constants.MessageFlags.EPHEMERAL
    });
}

function listenForMappingFile(interaction: CommandInteraction) {
    const channel = interaction.channel;
    let timeoutObj: NodeJS.Timeout;
    const msgListener = async (message: Eris.Message<Eris.PossiblyUncachedTextableChannel>) => {
        if (message.channel.id === channel.id && message.member && message.member.id === interaction.member!.id && message.attachments.length === 1) {
            clearTimeout(timeoutObj);
            bot.removeListener("messageCreate", msgListener);

            const res = await readFileFromURL(message.attachments[0].url, (line) => line.split("::") as [string, string, string, string, string]);
            exportedBot.emit("updatenames", interaction, res);
        }
    }

    timeoutObj = setTimeout(() => {
        bot.removeListener("messageCreate", msgListener);
        interaction.editOriginalMessage("Timed out waiting for mapping file.");
    }, 60000);

    bot.on("messageCreate", msgListener);
}

function handleAdminCommand(interaction: CommandInteraction) {
    if (!interaction.member!.permissions.has("administrator")) {
        interaction.createMessage({
            content: `Only Madfut Galore can use this command.`,
            flags: Constants.MessageFlags.EPHEMERAL
        });
        return;
    }
    const subcommand = interaction.data.options![0] as InteractionDataOptionsSubCommand;
    const subsubcmd = (subcommand.options![0] as InteractionDataOptionsSubCommand);
    const cmdName = subsubcmd.name;
                
    switch (cmdName) {
        case "ga-forcestart":
            exportedBot.emit("ga-forcestart", interaction);
            break;
        case "ga-forcestop":
            exportedBot.emit("ga-forcestop", interaction);
            break;
        case "ga-announce":
            exportedBot.emit("ga-announce", interaction, (subsubcmd.options![0] as InteractionDataOptionsString).value, (subsubcmd.options?.[1] as InteractionDataOptionsString)?.value ?? undefined);
            break;
        case 'un':
            interaction.createMessage("Send the mapping file within 1 minute.");
            listenForMappingFile(interaction);
            break;
        case 'ft':
            exportedBot.emit("freetrade", interaction, (subsubcmd.options!.find(option => option.name === 'a') as InteractionDataOptionsInteger)!.value, (subsubcmd.options!.find(option => option.name === 'u') as InteractionDataOptionsString)?.value ?? undefined, (subsubcmd.options!.find(option => option.name === 'du') as InteractionDataOptionsString)?.value ?? undefined);
            break;
        case 'sp':
            exportedBot.emit("setpacks", interaction, (subsubcmd.options![0] as InteractionDataOptionsString).value.split(".").filter(el => el.length));
            break;
        case 'lock':
            exportedBot.emit("lock", interaction, (subsubcmd.options![0] as InteractionDataOptionsString).value);
            break;
        case 'unlock':
            exportedBot.emit("unlock", interaction);
            break;
        case 'q':
            const query = (subsubcmd.options![0] as InteractionDataOptionsString).value;
            exportedBot.emit("rawquery", interaction, query.substr(3, query.length - 6));
            break;
        case 'pay': 
            const user = (subsubcmd.options![0] as InteractionDataOptionsUser).value;
            const payingCoins: number = (subsubcmd.options!.find(option => option.name === 'coins') as InteractionDataOptionsInteger)?.value ?? 0;
            const payingCardsStr: string = (subsubcmd.options!.find(option => option.name === 'cards') as InteractionDataOptionsString)?.value ?? "";
            const payingPacksStr: string = (subsubcmd.options!.find(option => option.name === 'packs') as InteractionDataOptionsString)?.value ?? "";

            const payingCards: string[] = payingCardsStr.split(",").filter(el => el.length);
            const payingPacks: string[] = payingPacksStr.split(".").filter(el => el.length);

            if (payingCoins === 0 && payingCards.length === 0 && payingPacks.length === 0) {
                interaction.createMessage("Input at least 1 item to pay.");
                break;
            }

            exportedBot.emit("admin-pay", interaction, user, payingCoins, payingCards, payingPacks);
            break;
        default:
            interaction.createMessage({
                content: `Unknown subcommand.`,
                flags: Constants.MessageFlags.EPHEMERAL
            });
            break;
    }
}

function handleModeratorCommand(interaction: CommandInteraction) {
    if (!(interaction.member!.roles.includes(config.moderatorRoleId) || interaction.member!.permissions.has("administrator"))) {
        interaction.createMessage({
            content: `Only moderators can use this command.`,
            flags: Constants.MessageFlags.EPHEMERAL
        });
        return;
    }

    const subcommand = interaction.data.options![0] as InteractionDataOptionsSubCommand;
    const subsubcmd = (subcommand.options![0] as InteractionDataOptionsSubCommand);
    const cmdName = subsubcmd.name;
                
    switch (cmdName) {
        case "im":
            const packs = (subsubcmd.options?.find(option => option.name === 'packs') as InteractionDataOptionsString)?.value?.split(".").filter(el => el.length) ?? undefined;
            const coins = (subsubcmd.options?.find(option => option.name === 'coins') as InteractionDataOptionsInteger)?.value ?? 10_000_000;

            exportedBot.emit("invme", interaction, coins, packs);
            break;
        case "force-end-transaction":
            exportedBot.emit("end-transaction", interaction, (subsubcmd.options![0] as InteractionDataOptionsUser).value);
            break;
        default:
            interaction.createMessage({
                content: `Unknown subcommand.`,
                flags: Constants.MessageFlags.EPHEMERAL
            });
            break;
    }
}

const moneyChannels = [config.commandsChannelId, config.tradingChannelId];
const moneyChannelsMention = `<#${moneyChannels[0]}> or <#${moneyChannels[1]}>`

bot.on("interactionCreate", (interaction) => {
    if (!(interaction as any).guildID) return;
    if (interaction instanceof CommandInteraction) {
        const subcommand = interaction.data.options![0] as InteractionDataOptionsSubCommand;
        switch (subcommand.name) {
            case 'link':
                if (interaction.channel.id !== config.commandsChannelId) {
                    interaction.createMessage({
                        content: `You can only use this command in the <#${config.commandsChannelId}> channel.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                if (subcommand.options) {
                    exportedBot.emit("link", interaction, (subcommand.options[0] as InteractionDataOptionsString).value);
                } else {
                    exportedBot.emit("viewlink", interaction);
                }
                break;
            case 'unlink':
                if (interaction.channel.id !== config.commandsChannelId) {
                    interaction.createMessage({
                        content: `You can only use this command in the <#${config.commandsChannelId}> channel.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                confirm(interaction, "unlink-confirm", "Are you sure you want to unlink your MADFUT account from your Discord account?");
                break;
            case 'admin':
                handleAdminCommand(interaction);
                break;
            case 'moderator':
                handleModeratorCommand(interaction);
                break;
            case 'wallet':
                if (!moneyChannels.includes(interaction.channel.id)) {
                    interaction.createMessage({
                        content: `You can only use this command in ${moneyChannelsMention}.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                exportedBot.emit("wallet", interaction, (subcommand.options?.[0] as InteractionDataOptionsInteger)?.value ?? 1);
                break;
            case 'deposit':
                if (!moneyChannels.includes(interaction.channel.id)) {
                    interaction.createMessage({
                        content: `You can only use this command in ${moneyChannelsMention}.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                exportedBot.emit("deposit", interaction, (subcommand.options?.[0] as InteractionDataOptionsBoolean)?.value ?? false);
                break;
            case 'withdraw':
                if (!moneyChannels.includes(interaction.channel.id)) {
                    interaction.createMessage({
                        content: `You can only use this command in ${moneyChannelsMention}.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                if (!subcommand.options) {
                    interaction.createMessage("Input at least 1 item to withdraw.");
                    break;
                }
                const wantedCoins: number = (subcommand.options.find(option => option.name === 'coins') as InteractionDataOptionsInteger)?.value ?? 0;
                const wantedCardsStr: string = (subcommand.options.find(option => option.name === 'cards') as InteractionDataOptionsString)?.value ?? "";
                const wantedPacksStr: string = (subcommand.options.find(option => option.name === 'packs') as InteractionDataOptionsString)?.value ?? "";

                const wantedCards: string[] = wantedCardsStr.split(",").filter(el => el.length);
                const wantedPacks: string[] = wantedPacksStr.split(",").filter(el => el.length);

                if (wantedCoins === 0 && wantedCards.length === 0 && wantedPacks.length === 0) {
                    interaction.createMessage("Input at least 1 item to withdraw.");
                    break;
                }

                exportedBot.emit("withdraw", interaction, wantedCoins, wantedCards, wantedPacks);
                break;
            case 'pay': {
                if (interaction.channel.id !== config.tradingChannelId) {
                    interaction.createMessage({
                        content: `You can only use this command in the <#${config.tradingChannelId}> channel.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                if (!subcommand.options || subcommand.options.length === 1) {
                    interaction.createMessage("Input at least 1 item to pay.");
                    break;
                }
                const user = (subcommand.options[0] as InteractionDataOptionsUser).value;
                const payingCoins: number = (subcommand.options.find(option => option.name === 'coins') as InteractionDataOptionsInteger)?.value ?? 0;
                const payingCardsStr: string = (subcommand.options.find(option => option.name === 'cards') as InteractionDataOptionsString)?.value ?? "";
                const payingPacksStr: string = (subcommand.options.find(option => option.name === 'packs') as InteractionDataOptionsString)?.value ?? "";

                const payingCards: string[] = payingCardsStr.split(",").filter(el => el.length);
                const payingPacks: string[] = payingPacksStr.split(",").filter(el => el.length);

                if (payingCoins === 0 && payingCards.length === 0 && payingPacks.length === 0) {
                    interaction.createMessage("Input at least 1 item to pay.");
                    break;
                }

                exportedBot.emit("pay", interaction, user, payingCoins, payingCards, payingPacks);
                break;
            }
            case 'trade': {
                if (interaction.channel.id !== config.tradingChannelId) {
                    interaction.createMessage({
                        content: `You can only use this command in the <#${config.tradingChannelId}> channel.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                if (!subcommand.options) {
                    interaction.createMessage("Input at least 1 item to give and 1 item to receive.");
                    break;
                }
                const user = (subcommand.options[0] as InteractionDataOptionsUser).value;

                const givingCoins: number = (subcommand.options.find(option => option.name === 'givecoins') as InteractionDataOptionsInteger)?.value ?? 0;
                const givingCardsStr: string = (subcommand.options.find(option => option.name === 'givecards') as InteractionDataOptionsString)?.value ?? "";
                const givingPacksStr: string = (subcommand.options.find(option => option.name === 'givepacks') as InteractionDataOptionsString)?.value ?? "";

                const givingCards: string[] = givingCardsStr.split(",").filter(el => el.length);
                const givingPacks: string[] = givingPacksStr.split(",").filter(el => el.length);

                if (givingCoins === 0 && givingCards.length === 0 && givingPacks.length === 0) {
                    interaction.createMessage("Input at least 1 item to give.");
                    break;
                }

                const receivingCoins: number = (subcommand.options.find(option => option.name === 'receivecoins') as InteractionDataOptionsInteger)?.value ?? 0;
                const receivingCardsStr: string = (subcommand.options.find(option => option.name === 'receivecards') as InteractionDataOptionsString)?.value ?? "";
                const receivingPacksStr: string = (subcommand.options.find(option => option.name === 'receivepacks') as InteractionDataOptionsString)?.value ?? "";

                const receivingCards: string[] = receivingCardsStr.split(",").filter(el => el.length);
                const receivingPacks: string[] = receivingPacksStr.split(",").filter(el => el.length);

                if (receivingCoins === 0 && receivingCards.length === 0 && receivingPacks.length === 0) {
                    interaction.createMessage("Input at least 1 item to receive.");
                    break;
                }

                exportedBot.emit("trade", interaction, user, givingCoins, givingCards, givingPacks, receivingCoins, receivingCards, receivingPacks);
                break;
            }
            case 'flip':
                if (interaction.channel.id !== config.coinFlipChannelId) {
                    interaction.createMessage({
                        content: `You can only use this command in the <#${config.coinFlipChannelId}> channel.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                if (!subcommand.options) break;
                const coins: number = (subcommand.options[0] as InteractionDataOptionsInteger)?.value ?? 0;
                const heads: boolean = (subcommand.options[1] as InteractionDataOptionsString)?.value === "heads";
                const user: string | undefined = (subcommand.options?.[2] as InteractionDataOptionsUser)?.value ?? undefined;

                if (coins <= 0) {
                    interaction.createMessage("The amount of coins must be greater than 0.");
                    break;
                }

                exportedBot.emit("flip", interaction, coins, heads, user);
                break;
            case 'withdraw-all':
                if (!moneyChannels.includes(interaction.channel.id)) {
                    interaction.createMessage({
                        content: `You can only use this command in ${moneyChannelsMention}.`,
                        flags: Constants.MessageFlags.EPHEMERAL
                    });
                    break;
                }
                exportedBot.emit("withdraw-all", interaction);
                break;
            default:
                break;
        }
    } else if (interaction instanceof ComponentInteraction) {
        if (interaction.type === Constants.InteractionTypes.MESSAGE_COMPONENT) {
            switch(interaction.data.custom_id) {
                case "unlink-confirm":
                    if (interaction.message.interaction!.member!.id !== interaction.member!.id) {
                        break;
                    }
                    exportedBot.emit("unlink", interaction);
                    break;
                case "trade-confirm":
                    if (!interaction.member!.id || (interaction.member!.id !== permittedReacts[interaction.message.id])) {
                        break;
                    }
                    exportedBot.emit("tradereact" + interaction.message.id as any, interaction, true);
                    break;
                case "trade-decline":
                    if (!interaction.member!.id || (interaction.member!.id !== permittedReacts[interaction.message.id])) {
                        break;
                    }
                    exportedBot.emit("tradereact" + interaction.message.id as any, interaction, false);
                    break;
                case "flip-confirm":
                    if (!interaction.member!.id || !(permittedReacts[interaction.message.id] === true || interaction.member!.id === permittedReacts[interaction.message.id])) {
                        break;
                    }
                    exportedBot.emit("flipreact" + interaction.message.id as any, interaction, true);
                    break;
                case "flip-decline":
                    if (!interaction.member!.id || (interaction.member!.id !== permittedReacts[interaction.message.id])) {
                        break;
                    }
                    exportedBot.emit("flipreact" + interaction.message.id as any, interaction, false);
                    break;
                case "giveaway-join":
                    exportedBot.emit("giveawayjoin", interaction, interaction.member!.id);
                    break;
                default:
                    break;
            }
        }
    }
});

// bot initialization end

export { exportedBot as bot }