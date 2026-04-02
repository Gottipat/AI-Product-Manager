declare module 'ghost-cursor-playwright' {
    import type { Page, ElementHandle } from 'playwright';

    export interface CursorActions {
        click(options?: Record<string, unknown>): Promise<void>;
        randomMove(): Promise<void>;
        move(selector: string | ElementHandle, options?: Record<string, unknown>): Promise<void>;
    }

    export interface Cursor {
        click(selector: string, options?: Record<string, unknown>): Promise<void>;
        move(selector: string, options?: Record<string, unknown>): Promise<void>;
        actions: CursorActions;
    }

    export function createCursor(page: Page): Cursor;
}
