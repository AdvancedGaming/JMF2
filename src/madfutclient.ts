import { Auth, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { FirebaseApp, initializeApp } from "firebase/app";
import { getRandomInt, sleep, listenForAll, Max3Array, Task, createTask } from "./util.js";
import { getDatabase, ref, onValue, onChildAdded, onChildChanged, onChildRemoved, onChildMoved, set, update, serverTimestamp, onDisconnect, off, Database, DatabaseReference, DataSnapshot } from "firebase/database";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";

const timeChars = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

interface PlayerProfile {
    a: string,
    b: string,
    c: string,
    d?: string[],
    e?: string[],
    f: string,
    h: string,
    i: string,
    j: string,
    k: string
}

const enum ProfileProperty {
    uid = 'a',
    username = 'b',
    nationId = 'c',
    wishList = 'd',
    messages = 'e',
    collectionPercentage = 'g'
}

type TradeResult = {
    netCoins: number,
    givenPacks: Record<string, number>,
    receivedPacks: Record<string, number>,
    givenCards: string[],
    receivedCards: string[]
}

type TradeRequirement = {
    receiveCoins: boolean,
    giveCoins: number,
    givePacks: Max3Array<{pack: string, amount: number}>,
    receivePacks: boolean,
    giveCards: Max3Array<string>,
    receiveCards: boolean
}

const EmptyTradeRequirement: TradeRequirement = {
    receiveCoins: false,
    giveCoins: 0,
    givePacks: [],
    receivePacks: false,
    giveCards: [],
    receiveCards: false
}

type ExtendedTradeRef = {
    tradeRef: DatabaseReference;
    amHosting: boolean;
}

interface PlayerAction {
    x: 'b' | 'e' | 'o' | 'q' | 'h' | 'i' | 'k' | 'l' | 'j';
}

const enum ActionType {
    loaded = 'b',
    putCard = 'e',
    putPack = 'o',
    putCoins = 'q',
    ready = 'h',
    unready = 'i',
    confirm = 'k',
    handshake = 'l',
    cancel = 'j',
    wantCoinsMessage = 'r',
    sendEmoji = 'n'
}

interface TradeHandshakePlayerAction extends PlayerAction {
    x: ActionType.handshake,
    a?: string[],
    b?: string[],
    c?: Record<string, number>,
    d?: Record<string, number>,
    e?: number
}

function isTradeHandshake(action: PlayerAction): action is TradeHandshakePlayerAction {
    return action.x === ActionType.handshake;
}

class MadfutClient {
    token: string;
    app: FirebaseApp;
    auth: Auth;
    username!: string;
    nationId!: string;
    uid!: string;
    invitesDatabase!: Database;
    tradingRoomDatabase!: Database;
    loggedIn: boolean;

    constructor(token: string) {
        this.loggedIn = false;
        this.token = token;

        this.app = initializeApp({
            apiKey: "AIzaSyBoG-C9bdnzeZpLViyFMoWgqnt6YHOQS_w",
            authDomain: "amf22-room-ids.europe-west1.firebaseapp.com",
            projectId: "madfut-22",
            storageBucket: "madfut-22.appspot.com",
            messagingSenderId: "871843261730",
            databaseURL: "https://amf22-trading-invites.europe-west1.firebasedatabase.app",
            appId: "1:871843261730:android:880b95ba9b0cb6ab10097b"
        });

        initializeAppCheck(this.app, { // discards return value of initializeAppCheck
            provider: new CustomProvider({
                getToken: () => {
                    return Promise.resolve({
                        token: this.token,
                        expireTimeMillis: 1637066608 * 1000 // TODO: read from token
                    });
                }
            })
        });

        this.auth = getAuth(this.app);
    }

    async login(username: string, password: string) {
        const {user} = await signInWithEmailAndPassword(this.auth, username, password);
        const splitDisplayName = user.displayName!.split(",");

        this.username = splitDisplayName[0];
        this.nationId = splitDisplayName[1];
        this.uid = user.uid;
        this.invitesDatabase = getDatabase(this.app);
        this.tradingRoomDatabase = getDatabase(this.app, "https://amf22-trading-rooms-1.europe-west1.firebasedatabase.app");
        this.loggedIn = true;
    }

    addInviteListener(callback: (username: string) => void, invitee?: string) {
        const invitesRef = ref(this.invitesDatabase, (invitee || this.username));
        onChildAdded(invitesRef, (snapshot) => {
            callback(snapshot.key!);
        });
        onChildChanged(invitesRef, (snapshot) => {
            if (typeof snapshot.val() === 'number') {
                callback(snapshot.key!);
            }
        });
    }

    async inviteUserCb(invitee: string, callback: (tradeRef: ExtendedTradeRef | null) => void, inviter?: string) {
        const invitePath = invitee + "/" + (inviter || this.username) + "," + this.nationId + "," + this.uid;
        const inviteRef = ref(this.invitesDatabase, invitePath);
        onDisconnect(inviteRef).remove();
        await set(inviteRef, Date.now() + 31536000000); // or serverTimestamp()
        onValue(inviteRef, snapshot => {
            if (typeof snapshot.val() === 'number') return;

            if (snapshot.val() == null) { // invite declined
                off(inviteRef);
                callback(null);
                return;
            }
            // invite accepted

            const tradeRef = ref(this.tradingRoomDatabase, snapshot.val());
            callback({tradeRef, amHosting: false});
        });
    }

    inviteWithTimeout(invitee: string, timeout: number, inviter?: string): Promise<ExtendedTradeRef> {
        return new Promise(async (resolve, reject) => {
            const invitePath = invitee + "/" + (inviter || this.username) + "," + this.nationId + "," + this.uid;
            const inviteRef = ref(this.invitesDatabase, invitePath);
            onDisconnect(inviteRef).remove();
            await set(inviteRef, serverTimestamp()); // or serverTimestamp()

            const timeoutObj = setTimeout(() => {
                off(inviteRef);
                reject();
                set(inviteRef, null);
            }, timeout);

            onValue(inviteRef, snapshot => {
                if (typeof snapshot.val() === 'number') return;
    
                if (snapshot.val() == null) { // invite declined
                    off(inviteRef);
                    reject();
                    return;
                }
                // invite accepted
    
                const tradeRef = ref(this.tradingRoomDatabase, snapshot.val());

                off(tradeRef);
                clearTimeout(timeoutObj);
                resolve({tradeRef, amHosting: false});
                set(inviteRef, null);
            });
        });
    }

    leaveTrade({tradeRef, amHosting}: ExtendedTradeRef): Promise<void> {
        return set(tradeRef, null);
    }

    inviteUser(invitee: string, inviter?: string): Promise<ExtendedTradeRef> {
        return new Promise(async (resolve, reject) => {
            const invitePath = invitee + "/" + (inviter || this.username) + "," + this.nationId + "," + this.uid;
            const inviteRef = ref(this.invitesDatabase, invitePath);
            onDisconnect(inviteRef).remove();
            await set(inviteRef, serverTimestamp()); // or serverTimestamp()
            onValue(inviteRef, snapshot => {
                if (typeof snapshot.val() === 'number') return;
    
                if (snapshot.val() == null) { // invite declined
                    off(inviteRef);
                    reject();
                    return;
                }
                // invite accepted
    
                const tradeRef = ref(this.tradingRoomDatabase, snapshot.val());

                off(tradeRef);
                resolve({tradeRef, amHosting: false});
                set(inviteRef, null);
            });
        });
    }

    acceptInvite(inviter: string, invitee?: string): Promise<ExtendedTradeRef> {
        return new Promise(async (resolve) => {
            let timeStamp = Date.now();
            let inviteArr = new Array(20);
            for (let i = 7; i >= 0; i--) {
                inviteArr[i] = timeChars.charAt(timeStamp % 64);
                timeStamp /= 64;
            }
    
            for (let i = 0; i < 12; i++) {
                inviteArr[8 + i] = timeChars.charAt(getRandomInt(64));
            }
    
            const inviteStr = inviteArr.join("");
    
            const inviteRef = ref(this.invitesDatabase, (invitee || this.username) + "/" + inviter);
    
            await set(inviteRef, inviteStr);
            const tradeRef = ref(this.tradingRoomDatabase, inviteStr);
    
            await update(tradeRef, {
                h: {
                    a: this.uid,
                    b: this.username,
                    c: '34',
                    d: ['id176922', 'id176922'],
                    e: [1, 1, 1, 1, 1, 1],
                    f: '',
                    g: '42069',
                    h: '',
                    i: '',
                    j: '',
                    k: ''
                },
                H: {
                    x: ActionType.loaded
                }
            });
    
            resolve({tradeRef, amHosting: true});
        });
    }

    doTrade({tradeRef, amHosting}: ExtendedTradeRef, giver: (profile: PlayerProfile) => Promise<TradeRequirement>): Promise<TradeResult> {
        return new Promise(async (resolve, reject) => {
            const otherProfile = amHosting ? "g": "h";
            const otherAction = amHosting ? "G": "H";
            const ownProfile = amHosting ? "h": "g";
            const ownAction = amHosting ? "H": "G";
            let loaded = false;
            let tradeReqTask: Task<TradeRequirement> = createTask();
            const self = this;
            // onDisconnect(tradeRef).remove();
            async function childUpdate(snapshot: DataSnapshot) {
                const snapshotVal = snapshot.val();
                if (snapshotVal === null) return;

                // console.log(snapshotVal);
                if (snapshot.key === otherProfile) {
                    tradeReqTask.finish(await giver(snapshotVal));
                    await update(tradeRef, {
                        [ownProfile]: {
                            a: self.uid,
                            b: self.username,
                            c: '34',
                            d: ['id176922', 'id176922'],
                            e: [1, 1, 1, 1, 1, 1],
                            f: '',
                            g: '42069',
                            h: '',
                            i: '',
                            j: '',
                            k: ''
                        },
                        [ownAction]: {
                            x: ActionType.loaded
                        },
                        ts: serverTimestamp()
                    });
                } else if (snapshot.key === otherAction) {
                    const tradeReq = await tradeReqTask.promise;

                    if (snapshotVal.x === ActionType.loaded) {
                        loaded = true;
                        await sleep(500);

                        for (let i = 0; i < tradeReq.giveCards.length; i++) {
                            await update(tradeRef, {
                                [ownAction]: {
                                    v: `${tradeReq.giveCards[i]},${i}`, x: ActionType.putCard
                                }
                            });
                        }
                        for (let i = 0; i < tradeReq.givePacks.length; i++) {
                            await update(tradeRef, {
                                [ownAction]: {
                                    a: tradeReq.givePacks[i].pack,
                                    b: tradeReq.givePacks[i].amount,
                                    c: i,
                                    x: ActionType.putPack
                                }
                            });
                        }

                        await update(tradeRef, {
                            [ownAction]: {
                                v: Math.max(tradeReq.giveCoins, 0),
                                x: ActionType.putCoins
                            }
                        });
                        
                    } else if (snapshotVal.x === ActionType.ready) {
                        await update(tradeRef, {
                            [ownAction]: {
                                x: ActionType.unready
                            }
                        });
                        await update(tradeRef, {
                            [ownAction]: {
                                x: ActionType.ready
                            }
                        });
                    } else if (snapshotVal.x === ActionType.confirm) {
                        await update(tradeRef, {
                            [ownAction]: {
                                x: ActionType.confirm
                            }
                        });
                    } else if (isTradeHandshake(snapshotVal)) { // handshake
                        const updates = [];

                        // a: cards I'm giving
                        // b: cards I'm getting
                        // c: packs I'm giving
                        // d: packs I'm getting
                        // e: net coins I'm getting
                        const newAction: TradeHandshakePlayerAction = {
                            x: ActionType.handshake
                        };

                        const cardsGivenByOther = snapshotVal.a ?? [];

                        if (!tradeReq.receiveCards && cardsGivenByOther.length > 0) {
                            updates.push({
                                [ownAction]: {
                                    v: "61",
                                    x: ActionType.sendEmoji
                                }
                            });
                        }

                        newAction.b = cardsGivenByOther;

                        const packsGivenByOther: Record<string, number> = snapshotVal.c ?? {};

                        if (!tradeReq.receivePacks && Object.keys(packsGivenByOther).length > 0) {
                            updates.push({
                                [ownAction]: {
                                    v: "62",
                                    x: ActionType.sendEmoji
                                }
                            });
                        }

                        newAction.d = packsGivenByOther;

                        const gottenCards: string[] = snapshotVal.b ?? []; // TODO: shortcut with alreadyUpdated

                        for (let i = 0, j = 0; i < tradeReq.giveCards.length; i++, j++) {
                            if (tradeReq.giveCards[i] != gottenCards[j]) {
                                updates.push({
                                    [ownAction]: {
                                        v: `${tradeReq.giveCards[i]},${i}`, x: ActionType.putCard
                                    }
                                });
                                j--;
                            }
                        }
                        newAction.a = tradeReq.giveCards;

                        const gottenPacks: Record<string, number> = snapshotVal.d ?? {};

                        for (let i = 0, j = 0; i < tradeReq.givePacks.length; i++, j++) {
                            if (!(tradeReq.givePacks[i].pack in gottenPacks)) {
                                updates.push({
                                    [ownAction]: {
                                        a: tradeReq.givePacks[i].pack,
                                        b: tradeReq.givePacks[i].amount,
                                        c: i,
                                        x: ActionType.putPack
                                    }
                                });
                                gottenPacks[tradeReq.givePacks[i].pack] = tradeReq.givePacks[i].amount;
                                j--;
                            }
                        }

                        newAction.c = gottenPacks;

                        let gottenCoins: number = snapshotVal.e ?? 0;

                        if (gottenCoins < tradeReq.giveCoins && !tradeReq.receiveCoins) {
                            updates.push({
                                [ownAction]: {
                                    v: Math.max(tradeReq.giveCoins, 0),
                                    x: ActionType.putCoins
                                }
                            });
                            
                            updates.push({
                                [ownAction]: {
                                    v: '00',
                                    x: ActionType.wantCoinsMessage
                                }
                            });
                        }

                        newAction.e = -gottenCoins;
                        
                        if (updates.length === 0) {
                            await update(tradeRef, {
                                [ownAction]: newAction
                            });

                            off(tradeRef);
                            resolve({
                                givenCards: newAction.a,
                                givenPacks: newAction.c,
                                netCoins: newAction.e,
                                receivedCards: newAction.b,
                                receivedPacks: newAction.d
                            });
                        } else {
                            await update(tradeRef, {
                                [ownAction]: {
                                    x: ActionType.cancel
                                }
                            });

                            await sleep(2000);

                            for (const updateElem of updates) {
                                await update(tradeRef, updateElem);
                            }
                        }
                    }
                }
            }
            onChildAdded(tradeRef, childUpdate);
            onChildChanged(tradeRef, childUpdate);
            onValue(tradeRef, async (snapshot) => {
                // console.log(snapshotVal);
                if (snapshot.val() == null && loaded) { // player left
                    off(tradeRef);
                    reject(null);
                }
            });
        });
    }
}

export default MadfutClient;
export {ProfileProperty, ExtendedTradeRef, TradeResult}