import * as admin from "firebase-admin";
import { ActiveSessions } from "../collections/ActiveSession"
import { Status } from "../../ActiveSession"
import { isValid } from "../../../helpers/nft"
import * as pluralize from "pluralize";
import { delay } from "../../../helpers/utils"

const RESPONSE_INVALID_HANDLE_FORMAT = 'Invalid handle. Only a-z, 0-9, dash (-), underscore (_), and period (.) are allowed.';
const RESPONSE_UNAVAILABLE_PAID = 'Sorry! This Handle is pending mint or already minted.';
const RESPONSE_UNAVAILABLE_TWITTER = 'Reserved! Please unlock with Twitter below.';
const RESPONSE_AVAILABLE_DEFAULT = 'Yay! This handle is available.';
const RESPONSE_BETA_PHASE_UNAVAILABLE = 'Legendary handles are not available yet.';
const RESPONSE_ACTIVE_SESSION_UNAVAILABLE = 'Pending purchase. Try a different variation.';
const RESPONSE_SPO_HANDLE_UNAVAILABLE = 'Reserved for the stake pool. Head to https://adahandle.com/spo.';
const RESPONSE_RESERVED_HANDLE_UNAVAILABLE = 'This Handle has a private reservation. Private reservations will be contacted separately.';
const RESPONSE_NOT_ALLOWED = 'Sorry, that handle is not allowed.'
const REGEX_SPLIT_ON_CHARS = /([0-9a-z]+)[.\-_]*/g
const REGEX_SPLIT_ON_NUMS = /([a-z]+)[0-9]*/g
const BETA_PHASE_MATCH = new RegExp(/.{2,}/g);

declare global {
    interface String {
        includesSingularOrPlural(word: string): boolean;
        replaceSingularOrPlural(word: string, replacement: string): string;
    }
}

String.prototype.includesSingularOrPlural = function (word: string): boolean {
    const singPlur = ReservedHandles.setSingular(word);
    return this.includes(singPlur.singular) || this.includes(singPlur.plural);
}

String.prototype.replaceSingularOrPlural = function (word: string, replacement: string): string {
    const singPlur = ReservedHandles.setSingular(word);
    return this.replace(singPlur.singular, replacement).replace(singPlur.plural, replacement);
}

export interface ProtectedWord {
    word: string;
    algorithms: ('modifier' | 'badword' | 'suggestive' | 'hatespeech' | 'vulnerable')[],
    modType?: ('modifier' | 'suggestive' | 'hatespeech')[],
    canBePositive?: boolean,
    position?: 'exact' | 'any' | 'beginswith',
    exceptions?: string[]
}

export interface HandleOptions {
    protected: ProtectedWord[];
    private: string[];
    spos: string[];
    twitter: { handle: string; index?: number }[];
}

export interface HandleAvailabilityResponse {
    available: boolean;
    message?: string;
    type?: 'twitter' | 'spo' | 'private' | 'pending' | 'notallowed' | 'invalid';
    link?: string; //`https://${process.env.CARDANOSCAN_DOMAIN}/token/${policyID}.${assetName}`
    reason?: string;
    duration?: number;
}

export class ReservedHandles {
    static readonly collectionPrivateHandles = 'reservedHandlesPrivate';
    static readonly collectionSPOs = 'reservedHandlesSPOs';
    static readonly collectionTwitter = 'reservedHandlesTwitter';
    static readonly collectionProtectedWords = 'protectedWords';
    static reservedHandles: HandleOptions;
    static readLock = false;
    static cacheResetTime: number;

    static async getReservedHandles(): Promise<HandleOptions> {
        const [protectedWords, reservedHandlesPrivate, reservedHandlesSPOs, reservedHandlesTwitter] = await Promise.all([
            admin.firestore().collection(ReservedHandles.collectionProtectedWords).get(),
            admin.firestore().collection(ReservedHandles.collectionPrivateHandles).get(),
            admin.firestore().collection(ReservedHandles.collectionSPOs).get(),
            admin.firestore().collection(ReservedHandles.collectionTwitter).get()
        ]);
        return {
            protected: protectedWords.docs.map(doc => doc.data() as ProtectedWord),
            private: reservedHandlesPrivate.docs.map(doc => doc.id.toLowerCase()),
            spos: reservedHandlesSPOs.docs.map(doc => doc.id.toLowerCase()),
            twitter: reservedHandlesTwitter.docs.map(doc => ({ handle: doc.id.toLowerCase(), index: doc.data().index })),
        } as HandleOptions
    }

    static async checkAvailability(handle: string): Promise<HandleAvailabilityResponse> {
        await delay(0); // This has to be here to allow early Promise return
        let waitTime = 0;
        const startTime = Date.now();
        const getDuration = (start: number, waitTime: number) => Date.now() - start - waitTime;

        handle = handle.toLowerCase();

        if (!handle.match(BETA_PHASE_MATCH)) {
            return {
                available: false,
                message: RESPONSE_BETA_PHASE_UNAVAILABLE,
                type: 'invalid',
                duration: getDuration(startTime, waitTime)
            };
        }

        if (!isValid(handle)) {
            return {
                available: false,
                message: RESPONSE_INVALID_HANDLE_FORMAT,
                type: 'invalid',
                duration: getDuration(startTime, waitTime)
            };
        }

        // //Now we can start hitting the db
        const activeSessions = await ActiveSessions.getByHandle(handle);

        if (activeSessions.some(session => session.status == Status.PENDING)) {
            return {
                available: false,
                message: RESPONSE_ACTIVE_SESSION_UNAVAILABLE,
                type: 'pending',
                duration: getDuration(startTime, waitTime)
            };
        }

        if (activeSessions.some(session => session.status == Status.PAID)) {
            return {
                available: false,
                message: RESPONSE_UNAVAILABLE_PAID,
                type: 'pending',
                duration: getDuration(startTime, waitTime)
            };
        }

        while (this.readLock) {
            // wait for the singleton static read to complete
            await delay(25);
            waitTime += 25;
        }
        if (!ReservedHandles.reservedHandles) {
            this.readLock = true;
            const startTimeCache = Date.now();
            ReservedHandles.reservedHandles = await ReservedHandles.getReservedHandles();
            const durationCache = Date.now() - startTimeCache;
            this.cacheResetTime = durationCache;
            this.readLock = false;
        }

        if (ReservedHandles.reservedHandles?.private.includes(handle)) {
            return {
                available: false,
                message: RESPONSE_RESERVED_HANDLE_UNAVAILABLE,
                type: 'private',
                duration: getDuration(startTime, waitTime)
            };
        }

        if (ReservedHandles.reservedHandles?.spos.includes(handle)) {
            return {
                available: false,
                message: RESPONSE_SPO_HANDLE_UNAVAILABLE,
                type: 'spo',
                duration: getDuration(startTime, waitTime)
            };
        }

        if (ReservedHandles.reservedHandles?.twitter.some(({ handle: twitterHandle }) => twitterHandle === handle)) {
            return {
                available: false,
                message: RESPONSE_UNAVAILABLE_TWITTER,
                type: 'twitter',
                duration: getDuration(startTime, waitTime)
            };
        }

        const notAllowedResponse: HandleAvailabilityResponse = {
            available: false,
            message: RESPONSE_NOT_ALLOWED,
            type: 'notallowed'
        };

        const allowedResponse: HandleAvailabilityResponse = {
            available: true,
            message: RESPONSE_AVAILABLE_DEFAULT
        };

        // if it is all numbers or non-alphas, we don't care
        if (handle.match(/^[0-9.\-_]{1,15}$/)) {
            allowedResponse.duration = getDuration(startTime, waitTime);
            return allowedResponse;
        }

        let handleMatches = handle.match(REGEX_SPLIT_ON_CHARS);

        if (handleMatches) {
            for (let i = 0; i < handleMatches?.length; i++) {
                const match = handleMatches[i];
                let listed = this.isProtected(match);
                // This will get `my.shit.stinks`, `_my-shits_stink`, `my.shitz.stink`, and `-my_shit5_stink-`
                if (listed.protected) {
                    notAllowedResponse.reason = `Protected word match on '${listed.words?.join(',')}'`;
                    notAllowedResponse.duration = getDuration(startTime, waitTime);
                    return notAllowedResponse;
                }

                // This will get `my.5h1t.stinks`, `_my-shi7s_stink`, `my_sh1tz.stink`, and `-my_5hit5_stink`
                listed = this.isNumberReplacementsProtected(match);
                if (listed.protected) {
                    notAllowedResponse.reason = `Number replacement match on '${listed.words?.join(',')}'`;
                    notAllowedResponse.duration = getDuration(startTime, waitTime);
                    return notAllowedResponse;
                }

                // This will get `my.123shit456`, `0shits0.stink`, `11shitz11.you`
                let handleTrimmed = this.trimChars(match, '0123456789');
                listed = this.isProtected(handleTrimmed);
                if (listed.protected) {
                    notAllowedResponse.reason = `Number trim match on '${listed.words?.join(',')}'`;
                    notAllowedResponse.duration = getDuration(startTime, waitTime);
                    return notAllowedResponse;
                }

                // This will get `1xshitx1`, `xxxshitsxxx`, `0x0shitz0x0`
                handleTrimmed = this.trimChars(match, 'x0123456789');
                listed = this.isProtected(handleTrimmed);
                if (listed.protected) {
                    notAllowedResponse.reason = `Number and 'x' trim match on '${listed.words?.join(',')}'`;
                    notAllowedResponse.duration = getDuration(startTime, waitTime);
                    return notAllowedResponse;
                }
            }
        }
        // This will get `.s.h.i.7.`, sh.1_7s`, `5.h-1-t__z`, and `sh1.t5`
        handle = handle.replace(/[.\-_]/g, '');
        const listed = this.isNumberReplacementsProtected(handle);
        if (listed.protected) {
            notAllowedResponse.reason = `Protected word match (with stripped characters) on '${listed.words?.join(',')}'`;
            notAllowedResponse.duration = getDuration(startTime, waitTime);
            return notAllowedResponse;
        }

        handleMatches = handle.match(REGEX_SPLIT_ON_NUMS);
        if (handleMatches) {
            for (let i = 0; i < handleMatches?.length; i++) {
                const match = handleMatches[i];
                // This will get `my1shit1stinks`, `0my1shits2stink`, `my3shitz4stink`, and `5my1shit5stink-`
                const listed = this.isProtected(match);
                if (listed.protected) {
                    notAllowedResponse.reason = `Split on numbers match for '${listed.words?.join(',')}'`;
                    notAllowedResponse.duration = getDuration(startTime, waitTime);
                    return notAllowedResponse;
                }
            }
        }

        // anywhere in the string and beginswith lookups
        // this will get `allmyshitsucks`, `eatsh17anddie`, `shithead`
        let matchResult = this.isNumberReplacementsProtected(handle, (h: string) => {
            let foundWord = '';
            // First check the 'any' list - anywhere in the string is bad
            if (ReservedHandles.reservedHandles.protected.some(entry => {
                foundWord = entry.word;
                return entry.position == 'any'
                    && !entry.exceptions?.some(exc => h.includes(exc))
                    && h.includesSingularOrPlural(entry.word)
            })) {
                return { protected: true, words: [foundWord] };
            }
            // Then check 'beginswith', a little note that "beginswith" works better when the next 
            // character is a consonant. This will let a few badwords through, but will greatly reduce
            // false positives.
            if (ReservedHandles.reservedHandles.protected.some(entry => {
                foundWord = entry.word;
                return entry.position == 'beginswith'
                    && h.startsWith(entry.word)
                    && !'aeiou'.includes(h.replaceSingularOrPlural(entry.word, '')?.charAt(0))
                    && !entry.exceptions?.some(exc => h.includes(exc))
            })) {
                return { protected: true, words: [foundWord] };
            }
            return { protected: false };
        })
        if (matchResult.protected) {
            notAllowedResponse.reason = `In string match found for '${matchResult.words?.join(',')}'`;
            notAllowedResponse.duration = getDuration(startTime, waitTime);
            return notAllowedResponse;
        }

        // "vulnerable" targets are slightly different than "hatespeech" targets, but we can combine them here for speed.
        const hatespeechEntries = ReservedHandles.reservedHandles.protected.filter(entry => entry.algorithms.includes('hatespeech') || entry.algorithms.includes('vulnerable'));
        const hatespeechWords = ReservedHandles.reservedHandles.protected.filter(entry => entry.modType?.includes('hatespeech'));
        // hatespeech lookups
        matchResult = this.isNumberReplacementsProtected(handle, (h: string) => {
            let foundWords = '';
            if (hatespeechEntries.some(entry => {
                return h.includesSingularOrPlural(entry.word)
                    // It's a hatespeech target and includes a hatespeech modifier (check exceptions)
                    && !entry.exceptions?.some(exc => h.includes(exc))
                    && hatespeechWords.some(hateWord => {
                        foundWords = `${entry.word},${hateWord.word}`
                        return h.replaceSingularOrPlural(entry.word, ' ').includes(hateWord.word)
                            && !hateWord.exceptions?.some(exc => h.includes(exc))
                            // If it's a vulnerable target, a positive word is fine
                            && !(entry.algorithms.includes('vulnerable') && hateWord.canBePositive)
                            // If it's not a bad word and it is a hatespeech target then a positive word is fine
                            && !(!entry.algorithms.includes('badword') && entry.algorithms.includes('hatespeech') && hateWord.canBePositive);
                    })
            })) {
                return { protected: true, words: foundWords.split(',') };
            }
            return { protected: false };
        })
        if (matchResult.protected) {
            notAllowedResponse.reason = `Hatespeech match found for ${matchResult.words?.join(',')}`;
            notAllowedResponse.duration = getDuration(startTime, waitTime);
            return notAllowedResponse;
        }

        // 'pp' can make some pretty bad phrases, but can't be dealt with normally since it is in so many "good" words
        // just combine with modifiers for now
        const specialCaseVulnWords = ["pp"];
        const modifiers = ReservedHandles.reservedHandles.protected.filter(entry => entry.modType?.includes('modifier'));

        // suggestive & vulnerable lookups - 'lickmyd1ck`, `s3xmyp3n1s`
        const suggestiveWords = ReservedHandles.reservedHandles.protected.filter(entry => entry.modType?.includes('suggestive'));
        const vulnerableEntries = ReservedHandles.reservedHandles.protected.filter(entry => entry.algorithms.includes('vulnerable'));
        const suggestiveEntries = ReservedHandles.reservedHandles.protected.filter(entry => entry.algorithms.includes('suggestive'));
        matchResult = this.isNumberReplacementsProtected(handle, (h: string) => {
            let foundWords = '';
            if ([...suggestiveEntries, ...vulnerableEntries].some(entry => {
                // is combined with a suggestive word, or another suggestive entry (from the same badwords list), or it's a modifier + `pp`
                return h.includesSingularOrPlural(entry.word)
                    && !entry.exceptions?.some(exc => h.includes(exc))
                    && (suggestiveWords.some(s => {
                        // is combined with a suggestive word (check exceptions)
                        foundWords = `${entry.word},${s.word}`
                        return h.replaceSingularOrPlural(entry.word, ' ').includes(s.word)
                            && !s.exceptions?.some(exc => h.includes(exc))
                            && !(entry.algorithms.includes('vulnerable') && s.canBePositive);
                    }) || suggestiveEntries.some(s => {
                        // is combined with another suggestive entry from the badwords list (check exceptions)
                        foundWords = `${entry.word},${s.word}`
                        return s != entry && h.replaceSingularOrPlural(entry.word, ' ').includesSingularOrPlural(s.word)
                            && !s.exceptions?.some(exc => h.includes(exc));
                    }) || modifiers.some(mod => h.replaceSingularOrPlural(entry.word, ' ').includes(mod.word)
                        // If it can be a positive modifier, like "love", then vulnerable targets are OK
                        && !(entry.algorithms.includes('vulnerable') && mod.canBePositive)
                        && specialCaseVulnWords.some(spec => {
                            // it's a modifier + `pp` - This is a hint that it's not a good phrase like "tinypreteenpp"
                            foundWords = `${entry.word},${mod.word},${spec}`
                            return h.replaceSingularOrPlural(entry.word, ' ').replaceSingularOrPlural(mod.word, ' ').includes(spec)
                        })))
            })) {
                return { protected: true, words: foundWords.split(',') };
            }
            return { protected: false };
        })
        if (matchResult.protected) {
            notAllowedResponse.reason = `Suggestive language match found for ${matchResult.words?.join(',')}`;
            notAllowedResponse.duration = getDuration(startTime, waitTime);
            return notAllowedResponse;
        }

        allowedResponse.duration = getDuration(startTime, waitTime);
        return allowedResponse;
    }

    static setSingular(handle: string): { plural: string, singular: string } {
        let singular = handle;
        let plural = handle;

        if (pluralize.isPlural(handle)) {
            singular = pluralize.singular(handle);
        }
        else {
            plural = pluralize(handle);
        }

        return { plural, singular };

    }

    static isNumberReplacementsProtected(handle: string, checkIfMatches?: (h: string) => { protected: boolean, words?: string[] }): { protected: boolean, words?: string[] } {
        if (checkIfMatches) {
            const matches = checkIfMatches(handle);
            if (matches.protected) return { protected: true, words: matches.words };
        }

        // 8's can be problematic (because they are replaced with 'ate' or 'ait').
        // When combined with multiple numbers they are probably not a bad word anyway
        let handleReplacedTemp = handle;

        // it's about 5x faster to check the includes first than it is to just call replace directly
        if (handleReplacedTemp.includes('8')) handleReplacedTemp = handleReplacedTemp.replace(/(8[0-9])|([0-9]8){2,}/g, '');
        if (handleReplacedTemp.includes('0')) handleReplacedTemp = handleReplacedTemp.replace(/0/g, 'o');
        if (handleReplacedTemp.includes('2')) handleReplacedTemp = handleReplacedTemp.replace(/2/g, 'z');
        if (handleReplacedTemp.includes('3')) handleReplacedTemp = handleReplacedTemp.replace(/3/g, 'e');
        if (handleReplacedTemp.includes('4')) handleReplacedTemp = handleReplacedTemp.replace(/4/g, 'a');
        if (handleReplacedTemp.includes('5')) handleReplacedTemp = handleReplacedTemp.replace(/5/g, 's');
        if (handleReplacedTemp.includes('6')) handleReplacedTemp = handleReplacedTemp.replace(/6/g, 'g');
        if (handleReplacedTemp.includes('7')) handleReplacedTemp = handleReplacedTemp.replace(/7/g, 't');
        if (handleReplacedTemp.includes('9')) handleReplacedTemp = handleReplacedTemp.replace(/9/g, 'g');
        if (handleReplacedTemp.includes('1') || handleReplacedTemp.includes('8')) {
            // ones and eights have two replaceable chars each
            // This logic isn't quite right. It should check each individual instance with either replacement
            // possible impprovement needed here to catch more words
            // letting it slide for now since number replacements are less obvious
            // and this is the slowest part of the algorithm
            for (const one in ['i', 'l']) {
                for (const eight in ['ate', 'ait']) {
                    const handleReplaced = handleReplacedTemp.replace(/1/g, one).replace(/8/g, eight)
                    const listed = this.isProtected(handleReplaced);
                    if (listed.protected) return { protected: true, words: listed.words };
                    if (checkIfMatches) {
                        const matches = checkIfMatches(handleReplaced);
                        if (matches.protected) return { protected: true, words: matches.words };
                    }
                }
            }
        }
        return { protected: false };
    }

    static isProtected(handle: string): { protected: boolean, words?: string[] } {
        let { singular } = this.setSingular(handle);
        let bad = this.isBadWord(singular);
        if (bad.badword) {
            return { protected: true, words: bad.words };
        }

        const pluralz = handle.replace(/[z5]$/, 's');

        if (pluralz != handle) {
            ({ singular } = this.setSingular(handle));
            bad = this.isBadWord(singular);
            if (bad.badword) {
                return { protected: true, words: bad.words };
            }
        }
        return { protected: false };
    }

    static isBadWord(handle: string): { badword: boolean, words?: string[] } {
        const protectedWords = ReservedHandles.reservedHandles.protected;
        const modifiers = ReservedHandles.reservedHandles.protected.filter(entry => entry.modType?.includes('modifier'));
        const found = protectedWords.find(x => x.word == handle && x.algorithms.includes('badword'));
        if (found) return { badword: true, words: [found.word] };
        let foundWords = '';
        if (modifiers.some(m => protectedWords.some(entry => {
            foundWords = `${entry.word},${m.word}`;
            // If there is a badword modifier word, then it's a hint that the phrase is bad (check exceptions)
            return entry.algorithms.includes('badword')
                && !entry.exceptions?.some(exc => handle.includes(exc))
                && !m.exceptions?.some(exc => handle.includes(exc))
                && (
                    // small modifiers (<3 chars) can increase false positives, so just check to see if they are at the beginning or end of the word
                    (m.word.length <= 3 && entry.word == handle.replace(new RegExp(`(^${m.word})|(${m.word}$)`), ''))
                    // if over 3 chars, check anywhere in the word
                    || (m.word.length > 3 && handle.includes(entry.word) && handle.replaceSingularOrPlural(entry.word, ' ').includes(m.word))
                )
        }))) {
            return { badword: true, words: foundWords.split(',') };
        }
        return { badword: false };
    }

    static trimChars(handle: string, chars: string): string {
        let startIndex = 0;
        let lastIndex = handle.length - 1;
        while (chars.includes(handle[startIndex])) { startIndex++; }
        while (chars.includes(handle[lastIndex])) { lastIndex--; }
        return handle.substring(startIndex, lastIndex + 1);
    }
}