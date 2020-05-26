import {FEATURES} from './features';
import {Logger} from './logger';
import {ElementContainer} from '../dom/element-container';

export class CacheStorage {
    private static _caches: {[key: string]: Cache} = {};
    private static _link?: HTMLAnchorElement;
    private static _origin: string = 'about:blank';
    private static _current: Cache | null = null;

    static create(name: string, options: ResourceOptions): Cache {
        let t = CacheStorage._caches[name];
        if(t) {
            return t;
        }
        CacheStorage._caches[name] = new Cache(name, options);
        return CacheStorage._caches[name]
    }

    static destroy(name: string): void {
        delete CacheStorage._caches[name];
    }

    public static clearAll(): void {
        Object.keys(CacheStorage._caches).forEach(function(key){
            CacheStorage._caches[key].clearWatchers()
        })
        CacheStorage._caches = {};
    }

    static open(name: string): Cache {
        const cache = CacheStorage._caches[name];
        if (typeof cache !== 'undefined') {
            return cache;
        }

        throw new Error(`Cache with key "${name}" not found`);
    }

    static getOrigin(url: string): string {
        let link = CacheStorage._link;
        if (!link) {
            return 'about:blank';
        }

        link.href = url;
        link.href = link.href; // IE9, LOL! - http://jsfiddle.net/niklasvh/2e48b/
        return link.protocol + link.hostname + link.port;
    }

    static isSameOrigin(src: string): boolean {
        return CacheStorage.getOrigin(src) === CacheStorage._origin;
    }

    public static setContext(window: Window) {
        CacheStorage._link = window.document.createElement('a');
        CacheStorage._origin = CacheStorage.getOrigin(window.location.href);
    }

    static getInstance(): Cache {
        const current = CacheStorage._current;
        if (current === null) {
            throw new Error(`No cache instance attached`);
        }
        return current;
    }

    static attachInstance(cache: Cache) {
        CacheStorage._current = cache;
    }

    static detachInstance() {
        CacheStorage._current = null;
    }
}

export interface ResourceOptions {
    imageTimeout: number;
    useCORS: boolean;
    allowTaint: boolean;
    proxy?: string;
}
const CACHE_ID = 'data-html2canvas-cache-id';
const IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';

export class Cache {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly _cache: {[key: string]: Promise<any>};
    private readonly _vdom: {[key: string]: HTMLElement};
    private readonly _parents: {[key: string]: string};
    private readonly _pcache: {[key: string]: ElementContainer};
    private readonly _options: ResourceOptions;
    private readonly id: string;
    private watcher: MutationObserver | null;
    private cache_seed: number;
    constructor(id: string, options: ResourceOptions) {
        this.id = id;
        this._options = options;
        this._cache = {};
        this._pcache = {};
        this._vdom = {};
        this._parents = {};
        this.watcher = null;
        this.cache_seed = Math.round(Math.random() * 1000) + Date.now();
    }

    addImage(src: string): Promise<void> {
        const result = Promise.resolve();
        if (this.has(src)) {
            return result;
        }

        if (isBlobImage(src) || isRenderable(src)) {
            this._cache[src] = this.loadImage(src);
            return result;
        }

        return result;
    }
    nextCacheId(): string{
        this.cache_seed = this.cache_seed + 1;
        return this.cache_seed.toString(16);
    }
    addNode(src: string,node: HTMLElement,parent: string) {
        if(src != "-1") {
            this._vdom[src] = node;
            this._parents[src] = parent;
        }
    }
    addElementContainer(src: string,node: ElementContainer) {
        if(src != "-1") {
            this._pcache[src] = node;
        }
    }
    removeNode(src: string) {
        if(src != "-1") {
            if(this._vdom[src]) {
                const pid = this._parents[src];
                if(pid) {
                    this.removeNode(pid)
                }
                delete this._vdom[src];
                delete this._parents[src];
                delete this._pcache[src];
            }
        }
    }
    cachedContainer(id: string) {
        return this._pcache[id];
    }
    cachedNode(id: string) {
        return this._vdom[id];
    }
    clearWatchers(){
        if(this.watcher)
            this.watcher.disconnect();
        this.watcher = null;
    }

    watch(node: HTMLElement){
        let me = this;
        if(me.watcher)
            return;
        function callback(mutationList: MutationRecord[]) {
            mutationList.forEach((mutation) => {
                switch(mutation.type) {
                    case 'childList':
                        let anode_element = mutation.target as HTMLElement;
                        let anid = anode_element.getAttribute(CACHE_ID) || "-1";
                        if(me.has_key(anid)) {
                            me.removeNode(anid);
                        }
                        let node_list = mutation.removedNodes;
                        if (node_list) {
                            for (let i = 0; i < node_list.length; i++) {
                                let node : Node = node_list[i];
                                if (node.nodeType == Node.ELEMENT_NODE) {
                                    let node_element = node as HTMLElement;
                                    let nid = node_element.getAttribute(CACHE_ID) || "-1";
                                    if(me.has_key(nid)) {
                                        me.removeNode(nid);
                                    }
                                }
                            }
                        }
                        break;
                    case 'attributes':
                        let node_element = mutation.target as HTMLElement;
                        if(node_element.getAttribute(IGNORE_ATTRIBUTE) == "true")
                            break;
                        let nid = node_element.getAttribute(CACHE_ID) || "-1";
                        if(me.has_key(nid)) {
                            me.removeNode(nid);
                        }
                        break;
                }
            });
        }
        me.watcher = new MutationObserver(callback);
        me.watcher.observe(node,{
            childList: false,
            attributes: true,
            attributeOldValue: true,
            subtree: true,
            attributeFilter: ['hidden','style','class']//['hidden','style','class'],
        })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    match(src: string): Promise<any> {
        return this._cache[src];
    }

    private async loadImage(key: string) {
        const isSameOrigin = CacheStorage.isSameOrigin(key);
        const useCORS =
            !isInlineImage(key) && this._options.useCORS === true && FEATURES.SUPPORT_CORS_IMAGES && !isSameOrigin;
        const useProxy =
            !isInlineImage(key) &&
            !isSameOrigin &&
            typeof this._options.proxy === 'string' &&
            FEATURES.SUPPORT_CORS_XHR &&
            !useCORS;
        if (!isSameOrigin && this._options.allowTaint === false && !isInlineImage(key) && !useProxy && !useCORS) {
            return;
        }

        let src = key;
        if (useProxy) {
            src = await this.proxy(src);
        }

        Logger.getInstance(this.id).debug(`Added image ${key.substring(0, 256)}`);

        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            //ios safari 10.3 taints canvas with data urls unless crossOrigin is set to anonymous
            if (isInlineBase64Image(src) || useCORS) {
                img.crossOrigin = 'anonymous';
            }
            img.src = src;
            if (img.complete === true) {
                // Inline XML images may fail to parse, throwing an Error later on
                setTimeout(() => resolve(img), 500);
            }
            if (this._options.imageTimeout > 0) {
                setTimeout(
                    () => reject(`Timed out (${this._options.imageTimeout}ms) loading image`),
                    this._options.imageTimeout
                );
            }
        });
    }

    has_key(key: string){
        return typeof this._vdom[key] !== 'undefined';
    }

    has_container_key(key: string){
        return typeof this._pcache[key] !== 'undefined';
    }


    private has(key: string): boolean {
        return typeof this._cache[key] !== 'undefined';
    }

    keys(): Promise<string[]> {
        return Promise.resolve(Object.keys(this._cache));
    }

    private proxy(src: string): Promise<string> {
        const proxy = this._options.proxy;

        if (!proxy) {
            throw new Error('No proxy defined');
        }

        const key = src.substring(0, 256);

        return new Promise((resolve, reject) => {
            const responseType = FEATURES.SUPPORT_RESPONSE_TYPE ? 'blob' : 'text';
            const xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (responseType === 'text') {
                        resolve(xhr.response);
                    } else {
                        const reader = new FileReader();
                        reader.addEventListener('load', () => resolve(reader.result as string), false);
                        reader.addEventListener('error', e => reject(e), false);
                        reader.readAsDataURL(xhr.response);
                    }
                } else {
                    reject(`Failed to proxy resource ${key} with status code ${xhr.status}`);
                }
            };

            xhr.onerror = reject;
            xhr.open('GET', `${proxy}?url=${encodeURIComponent(src)}&responseType=${responseType}`);

            if (responseType !== 'text' && xhr instanceof XMLHttpRequest) {
                xhr.responseType = responseType;
            }

            if (this._options.imageTimeout) {
                const timeout = this._options.imageTimeout;
                xhr.timeout = timeout;
                xhr.ontimeout = () => reject(`Timed out (${timeout}ms) proxying ${key}`);
            }

            xhr.send();
        });
    }
}

const INLINE_SVG = /^data:image\/svg\+xml/i;
const INLINE_BASE64 = /^data:image\/.*;base64,/i;
const INLINE_IMG = /^data:image\/.*/i;

const isRenderable = (src: string): boolean => FEATURES.SUPPORT_SVG_DRAWING || !isSVG(src);
const isInlineImage = (src: string): boolean => INLINE_IMG.test(src);
const isInlineBase64Image = (src: string): boolean => INLINE_BASE64.test(src);
const isBlobImage = (src: string): boolean => src.substr(0, 4) === 'blob';

const isSVG = (src: string): boolean => src.substr(-3).toLowerCase() === 'svg' || INLINE_SVG.test(src);
