import {DocumentCloner} from '../dom/document-cloner';

export class FastModeCloner {
    constructor(
        private documentCloner: DocumentCloner,
        private element: HTMLElement,
        private containerWindow: Window,
        private referenceSelector: string
    ) {}

    private waitForImageLoad(image: any) {
        return new Promise(res => {
            if (image.complete || image.readyState === 4) {
                res(true);
            } else if (image.readyState === 'uninitialized' && image.src.indexOf('data:') === 0) {
                res(false);
            } else {
                image.addEventListener('load', () => {
                    res(true);
                });

                image.addEventListener('error', () => {
                    res(false);
                });
            }
        });
    }

    private waitForLoad(clonedElement: any) {
        return new Promise(async res => {
            const images = clonedElement.querySelectorAll('img') as NodeList;
            const imgResolvePromises: any[] = [];
            images.forEach(img => {
                imgResolvePromises.push(this.waitForImageLoad(img));
            });
            await Promise.all(imgResolvePromises);
            res();
        });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    public async clone(): Promise<{clonedElement: HTMLElement} | null> {
        const documentCloner = this.documentCloner;
        const element = this.element;
        const referenceSelector = this.referenceSelector;
        const containerWindow = this.containerWindow;
        let copyRef = null;
        if(this.documentCloner.options.useCache && this.documentCloner.options.cache.has_key(element.getAttribute('data-html2canvas-cache-id') || "-1")) {
            copyRef = this.documentCloner.options.cache.cachedNode(element.getAttribute('data-html2canvas-cache-id') || "-1");
            if(copyRef)
                return {
                    clonedElement: copyRef as any
                };
        }
        let clonedReferenceNode = documentCloner.cloneNode(element);
        if (clonedReferenceNode) {
            const containerDoc = containerWindow.document;
            const containerReferenceElement = containerDoc.querySelector(referenceSelector);
            if (containerReferenceElement) {
                containerReferenceElement.replaceWith(clonedReferenceNode);
                await this.waitForLoad(clonedReferenceNode);
                if(this.documentCloner.options.useCache) {
                    let sid = this.documentCloner.options.cache.nextCacheId();
                    let tl = clonedReferenceNode as HTMLElement;
                    tl.setAttribute("data-html2canvas-cache-id",sid)
                    this.documentCloner.options.cache.addNode(sid,tl,tl.parentElement!.getAttribute("data-html2canvas-cache-id") || "-1")
                } else {
                    let tl = clonedReferenceNode as HTMLElement;
                    tl.removeAttribute("data-html2canvas-cache-id")
                }
                return {
                    clonedElement: clonedReferenceNode as any
                };
            }
        }
        return null;
    }
}
