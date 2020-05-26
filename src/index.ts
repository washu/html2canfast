import {Bounds, parseBounds, parseDocumentSize} from './css/layout/bounds';
import {color, Color, COLORS, isTransparent} from './css/types/color';
import {Parser} from './css/syntax/parser';
import {CloneOptions, DocumentCloner} from './dom/document-cloner';
import {isBodyElement, isHTMLElement, parseTree, parseCacheTree} from './dom/node-parser';
import {Logger} from './core/logger';
import {CacheStorage, ResourceOptions} from './core/cache-storage';
import {CanvasRenderer, RenderOptions} from './render/canvas/canvas-renderer';
import {ForeignObjectRenderer} from './render/canvas/foreignobject-renderer';
import {IframeStorage} from './core/iframe-storage';
import {FastModeCloner} from './core/fast-mode-cloner';

declare global {
    interface Window { __h2cf_img_cache: any; __h2cf_if_cache: any }
}
export type Options = CloneOptions &
    RenderOptions &
    ResourceOptions & {
        backgroundColor: string | null;
        foreignObjectRendering: boolean;
        logging: boolean;
        removeContainer?: boolean;
        renderName?: string | null;
        replaceSelector?: string | null;
        reuseCache?: string | null;
        useCache: boolean;
    };

const parseColor = (value: string): Color => color.parse(Parser.create(value).parseComponentValue());

const html2canvas = (element: HTMLElement, options: Partial<Options> = {}): Promise<HTMLCanvasElement> => {
    if (typeof window !== 'undefined') {
        window.__h2cf_img_cache = CacheStorage;
        window.__h2cf_if_cache = IframeStorage;
    }
    return renderElement(element, options);
};

export default html2canvas;

if (typeof window !== 'undefined') {
    CacheStorage.setContext(window);
    window.__h2cf_img_cache = CacheStorage;
    window.__h2cf_if_cache = IframeStorage;
}

const renderElement = async (element: HTMLElement, opts: Partial<Options>): Promise<HTMLCanvasElement> => {
    const ownerDocument = element.ownerDocument;

    if (!ownerDocument) {
        throw new Error(`Element is not attached to a Document`);
    }

    const defaultView = ownerDocument.defaultView;

    if (!defaultView) {
        throw new Error(`Document is not attached to a Window`);
    }

    const instanceName = opts.reuseCache ? opts.reuseCache : (Math.round(Math.random() * 1000) + Date.now()).toString(16);

    const {width, height, left, top} =
        isBodyElement(element) || isHTMLElement(element) ? parseDocumentSize(ownerDocument) : parseBounds(element);

    const defaultResourceOptions = {
        allowTaint: false,
        imageTimeout: 15000,
        proxy: undefined,
        useCORS: false
    };

    const resourceOptions: ResourceOptions = {...defaultResourceOptions, ...opts};

    const defaultOptions = {
        backgroundColor: '#ffffff',
        cache: opts.cache ? opts.cache : CacheStorage.create(instanceName, resourceOptions),
        logging: true,
        removeContainer: true,
        foreignObjectRendering: false,
        scale: defaultView.devicePixelRatio || 1,
        windowWidth: defaultView.innerWidth,
        windowHeight: defaultView.innerHeight,
        scrollX: defaultView.pageXOffset,
        scrollY: defaultView.pageYOffset,
        x: left,
        y: top,
        width: Math.ceil(width),
        height: Math.ceil(height),
        id: instanceName,
        renderName: null,
        replaceSelector: null,
        reuseCache: null,
        useCache: false
    };

    const options: Options = {...defaultOptions, ...resourceOptions, ...opts};

    const windowBounds = new Bounds(options.scrollX, options.scrollY, options.windowWidth, options.windowHeight);

    Logger.create({id: instanceName, enabled: true}); //options.logging});
    Logger.getInstance(instanceName).debug(`Starting document clone`);
    const documentCloner = new DocumentCloner(element, {
        id: instanceName,
        cache: options.cache,
        onclone: options.onclone,
        ignoreElements: options.ignoreElements,
        inlineImages: options.foreignObjectRendering,
        copyStyles: options.foreignObjectRendering,
        useCache: opts.reuseCache != null
    });

    let clonedElement: HTMLElement | undefined;

    let container!: HTMLIFrameElement;

    if (options.replaceSelector && options.renderName) {
        Logger.getInstance(instanceName).debug("using cached iframe and cloner")
        const cachedIframe = IframeStorage.getIframe(options.renderName);

        if (cachedIframe && cachedIframe.iframe.contentWindow !== null) {
            container = cachedIframe.iframe;

            const containerWindow = cachedIframe.iframe.contentWindow;

            const fastClone = new FastModeCloner(documentCloner, element, containerWindow, options.replaceSelector);
            Logger.getInstance(instanceName).debug(`Fast clone start`);
            const cloneResult = await fastClone.clone();
            Logger.getInstance(instanceName).debug(`Flast clone end call`);

            if (!cloneResult) {
                throw new Error('An Error occured, trying to fast clone!');
            }

            clonedElement = cloneResult.clonedElement;
        } else {
            Logger.getInstance(instanceName).debug(`Using fresh cloner`);
            documentCloner.cloneDocument();
            options.cache.watch(element);
            Logger.getInstance(instanceName).debug(`End clone call`);

            clonedElement = documentCloner.clonedReferenceElement;

            Logger.getInstance(instanceName).debug(`ToIframe start`);
            container = await documentCloner.toIFrame(ownerDocument, windowBounds);
            Logger.getInstance(instanceName).debug(`ToIframe end`);
        }
    } else {
        Logger.getInstance(instanceName).debug("Using fresh cloner and iframe")
        documentCloner.cloneDocument();
        Logger.getInstance(instanceName).debug(`End clone call`);

        clonedElement = documentCloner.clonedReferenceElement;

        Logger.getInstance(instanceName).debug(`ToIframe start`);
        container = await documentCloner.toIFrame(ownerDocument, windowBounds);
        Logger.getInstance(instanceName).debug(`ToIframe end`);
    }

    if (!clonedElement) {
        return Promise.reject(`Unable to find element in cloned iframe`);
    }

    // http://www.w3.org/TR/css3-background/#special-backgrounds
    const documentBackgroundColor = ownerDocument.documentElement
        ? parseColor(getComputedStyle(ownerDocument.documentElement).backgroundColor as string)
        : COLORS.TRANSPARENT;
    const bodyBackgroundColor = ownerDocument.body
        ? parseColor(getComputedStyle(ownerDocument.body).backgroundColor as string)
        : COLORS.TRANSPARENT;

    const bgColor = opts.backgroundColor;
    const defaultBackgroundColor =
        typeof bgColor === 'string' ? parseColor(bgColor) : bgColor === null ? COLORS.TRANSPARENT : 0xffffffff;

    const backgroundColor =
        element === ownerDocument.documentElement
            ? isTransparent(documentBackgroundColor)
                ? isTransparent(bodyBackgroundColor)
                    ? defaultBackgroundColor
                    : bodyBackgroundColor
                : documentBackgroundColor
            : defaultBackgroundColor;

    const renderOptions = {
        id: instanceName,
        cache: options.cache,
        canvas: options.canvas,
        backgroundColor,
        scale: options.scale,
        x: options.x,
        y: options.y,
        scrollX: options.scrollX,
        scrollY: options.scrollY,
        width: options.width,
        height: options.height,
        windowWidth: options.windowWidth,
        windowHeight: options.windowHeight
    };

    let canvas;

    if (options.foreignObjectRendering) {
        Logger.getInstance(instanceName).debug(`Document cloned, using foreign object rendering`);
        const renderer = new ForeignObjectRenderer(renderOptions);
        canvas = await renderer.render(clonedElement);
    } else {
        Logger.getInstance(instanceName).debug(`Document cloned, using computed rendering`);

        CacheStorage.attachInstance(options.cache);

        Logger.getInstance(instanceName).debug(`Starting DOM parsing`);
        const root = options.reuseCache ? parseCacheTree(clonedElement,options.cache) : parseTree(clonedElement);
        CacheStorage.detachInstance();

        if (backgroundColor === root.styles.backgroundColor) {
            root.styles.backgroundColor = COLORS.TRANSPARENT;
        }

        Logger.getInstance(instanceName).debug(`Starting renderer`);

        const renderer = new CanvasRenderer(renderOptions);
        canvas = await renderer.render(root);
    }

    if (options.removeContainer === true) {
        if (!DocumentCloner.destroy(container)) {
            Logger.getInstance(instanceName).error(`Cannot detach cloned iframe as it is not in the DOM anymore`);
        }
    }

    // Save it.
    if (!!options.renderName) {
        IframeStorage.saveIframe(options.renderName, container);
    }

    Logger.getInstance(instanceName).debug(`Finished rendering`);
    Logger.destroy(instanceName);
    if (!options.reuseCache) {
        IframeStorage.clearAll();
        CacheStorage.clearAll();
    }
    return canvas;
};
