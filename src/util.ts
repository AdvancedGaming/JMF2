import { onValue, onChildAdded, onChildChanged, onChildRemoved, onChildMoved, DatabaseReference} from "firebase/database";
import https from 'https';
import readline from 'readline';

type Task<T> = {
    done: boolean,
    promise: Promise<T>,
    cancel: (err: Error) => void,
    finish: (result?: T) => void
}

function createTask<T>(): Task<T> {
    const task: any = {
      done: false
    }
    task.promise = new Promise((resolve, reject) => {
        task.cancel = (err: Error) => {
            if (!task.done) {
                task.done = true
                reject(err)
            }
        }
        task.finish = (result?: T) => {
            if (!task.done) {
                task.done = true
                resolve(result)
            }
        }
    })
    return task as Task<T>;
  }

function getRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function listenForAll(dbRef: DatabaseReference) {
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        console.log("Vdata: ", data);
    });

    onChildAdded(dbRef, (snapshot) => {
        const data = snapshot.val();
        console.log("CAdata:", data);
    });

    onChildChanged(dbRef, (snapshot) => {
        const data = snapshot.val();
        console.log("CCdata:", data);
    });

    onChildMoved(dbRef, (snapshot) => {
        const data = snapshot.val();
        console.log("CMdata:", data);
    });

    onChildRemoved(dbRef, (snapshot) => {
        const data = snapshot.val();
        console.log("CRdata:", data);
    });
}

function withTimeout(promise: Promise<any>, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
        promise.then((...data): void => resolve(...data));
        setTimeout(() => {
            reject();
        }, timeout);
    });
}

function normalize(str: string): string {
    return str.normalize('NFD').replace(/(<:ph0t0shop:910908399275876362>|[\u0300-\u036f ])/g, "").toLowerCase().trim();
}

function readFileFromURL<T>(url: string, mapper: (line: string) => T): Promise<T[]> {
    return new Promise(resolve => {
        https.get(url, async (res) => {
            res.setEncoding('utf8');

            const result: T[] = [];

            const rl = readline.createInterface({
                input: res,
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                result.push(mapper(line));
            }

            resolve(result);
        });
    });
}

function extractAmount(str: string): [string, number] {
    let i = 0;
    let char;
    for (; i < str.length; i++) {
        char = str[i];
        if (char < '0' || char > '9') { // is not number
            break;
        }
    }
    if (i == 0 || str[i] != 'x') { // break after not seeing any number or next is not x
        return [str, 1];
    }
    return [str.substring(i + 1).trim(), parseInt(str)] // TODO: change this to parseInt(str)
}

function formatNum(num: number) {
    return num.toLocaleString('en-US', {maximumFractionDigits:0})
}

type Max3Array<T> = [T, T, T] | [T, T] | [T] | [];

interface Hashable {
    id: string;
}

class ObjectSet<T extends Hashable> {
    private dict: Record<string, T>;

    constructor(items?: Iterable<T>) {
        this.dict = {};
        if (items) {
            for (const item of items) {
                this.add(item);
            }
        }
    }

    get size(): number {
        return Object.keys(this.dict).length;
    }

    add(value: T): this {
        this.dict[value.id] = value;
        return this;
    }

    clear(): void {
        this.dict = {};
    }

    delete(value: T): boolean {
        return delete this.dict[value.id];
    }

    map<M>(mapFunc: (element: T) => M): M[] {
        const res: M[] = [];
        for (const value of this) {
            res.push(mapFunc(value));
        }

        return res;
    }

    getById(id: string): T | undefined {
        return this.dict[id];
    }

    has(value: T): boolean {
        return value.id in this.dict;
    }
    
    *[Symbol.iterator](): IterableIterator<T> {
        for (const item in this.dict) {
            yield this.dict[item];
        }
    }
}

function UTF8ToBase64(str: string): string {
    return Buffer.from(encodeURIComponent(str), 'utf-8').toString('base64');
}

function base64ToUTF8(str: string): string {
    return decodeURIComponent(Buffer.from(str, 'base64').toString("utf-8"));
}

export {
    getRandomInt, sleep, listenForAll, createTask, Task, withTimeout, readFileFromURL, Max3Array, formatNum, normalize, extractAmount, ObjectSet, UTF8ToBase64, base64ToUTF8
}