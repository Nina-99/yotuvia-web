import { useEffect } from "react";

/**
 * Sets the document title for the lifetime of the calling component.
 *
 * The title is re-applied whenever it changes, which covers i18n language
 * switches. The browser tab keeps the last value after unmount, so pages that
 * mount later are expected to set their own title.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
