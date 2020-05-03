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

        const clonedReferenceNode = documentCloner.cloneNode(element);

        console.log(clonedReferenceNode);

        if (clonedReferenceNode) {
            console.log('Inside!');
            const containerDoc = containerWindow.document;

            const containerReferenceElement = containerDoc.querySelector(referenceSelector);

            if (containerReferenceElement) {
                console.log('Even here...');
                containerReferenceElement.replaceWith(clonedReferenceNode);

                await this.waitForLoad(clonedReferenceNode);

                return {
                    clonedElement: clonedReferenceNode as any
                };
            }
        }

        return null;
    }
}
