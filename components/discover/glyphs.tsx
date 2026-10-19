import { Icon } from "@/components/ui/icon";

// Thin wrappers over the official Solar <Icon/>, kept so Discover call sites don't change.
type P = { className?: string };

export const SearchGlyph = ({ className = "size-5" }: P) => <Icon name="search" className={className} />;
export const ChevronDownGlyph = ({ className = "size-4" }: P) => <Icon name="chevronDown" className={className} />;
export const CheckGlyph = ({ className = "size-4" }: P) => <Icon name="check" className={className} />;
export const RefreshGlyph = ({ className = "size-5" }: P) => <Icon name="refresh" className={className} />;
export const PlayGlyph = ({ className = "size-3" }: P) => <Icon name="play" filled className={className} />;
export const ClapperboardGlyph = ({ className = "size-3" }: P) => <Icon name="clapperboard" filled className={className} />;
export const LayersGlyph = ({ className = "size-3" }: P) => <Icon name="copy" filled className={className} />;
export const BagGlyph = ({ className = "size-3" }: P) => <Icon name="bag" filled className={className} />;
