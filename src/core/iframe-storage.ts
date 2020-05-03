/* eslint-disable @typescript-eslint/explicit-member-accessibility */
export class IframeStorage {
    private static storage: {iframe: HTMLIFrameElement; key: string}[] = [];

    constructor() {}

    public static clearAll() {
        this.storage.forEach(frame => {
            frame.iframe.remove();
        });

        this.storage = [];
    }

    public static saveIframe(key: string, iframe: HTMLIFrameElement) {
        const frameIndex = this.storage.findIndex(fr => fr.key === key);

        if (frameIndex !== -1) {
            this.storage[frameIndex].iframe = iframe;
        } else {
            this.storage.push({
                iframe,
                key
            });
        }
    }

    public static deleteIframe(key: string) {
        const frameIndex = this.storage.findIndex(fr => fr.key === key);

        const frame = this.storage[frameIndex];

        if (frame && frameIndex !== -1) {
            frame.iframe.remove();
            this.storage.splice(frameIndex, 1);
        }
    }

    public static getIframe(key: string) {
        return this.storage.find(fr => fr.key === key);
    }
}
