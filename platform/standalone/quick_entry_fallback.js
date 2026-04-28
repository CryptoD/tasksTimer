// Compatibility shim: keep existing `imports.platform.standalone.quick_entry_fallback`
// working while phase-1 feature layout lands under `src/features/*`.
const Mod = imports.src.features['quick-entry-fallback'].quick_entry_fallback;
var QuickEntryFallback = Mod.QuickEntryFallback;
var parseDurationFallback = Mod.parseDurationFallback;

