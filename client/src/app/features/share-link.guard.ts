import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { SavedCalculationKind } from '../core/models/saved-calculation.models';
import { readShareLink } from '../core/state/share-link';
import { CalculationStores } from './calculation-stores';

/** The page each address opens, for a link that cannot be read. */
const KIND_OF: Record<string, SavedCalculationKind> = {
  calculator: 'Purchase', compare: 'HomeComparison', refinance: 'Refinance', strategy: 'Strategy',
};

/**
 * Opens a share link (`…#share=…`) before its page does, so the page's form starts from the shared inputs, then
 * drops the fragment from the address. A link opens on the page of its own kind, on the tab it was made on when that
 * is the page named. A link that cannot be read changes nothing, and the page says so.
 */
export const openShareLink: CanActivateFn = (route, state) => {
  const link = readShareLink(route.fragment);
  if (link === null) return true;

  const router = inject(Router);
  const stores = inject(CalculationStores);
  const here = withoutFragment(router.parseUrl(state.url));
  const page = KIND_OF[here.root.children['primary']?.segments[0]?.path ?? ''] ?? 'Purchase';

  if (link === 'broken') {
    stores.of(page).linkProblem.set('This link could not be opened. It may have been cut short when it was copied.');
    return here;
  }
  const store = stores.of(link.kind);
  store.openShared(link.request);
  return link.kind === page ? here : router.createUrlTree([...store.route]);
};

function withoutFragment(url: UrlTree): UrlTree {
  url.fragment = null;
  return url;
}
