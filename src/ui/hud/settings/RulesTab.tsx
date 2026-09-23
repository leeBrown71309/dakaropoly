import type { ReactNode } from "react";
import { useCompact } from "../../useViewport";
import { Icon, type IconName } from "../../icons/Icon";

/** The four numbers a player asks about most, before any sentence. */
const ESSENTIALS: { label: string; value: string; hint: string }[] = [
  { label: "Départ", value: "+200 F", hint: "le double pile dessus" },
  { label: "Prison", value: "50 F", hint: "ou un double, ou une carte" },
  { label: "Hypothèque", value: "50 %", hint: "du prix · +10 % pour lever" },
  { label: "Banque", value: "32 · 12", hint: "maisons · hôtels" },
];

function Essentials() {
  const compact = useCompact();
  return (
    <div className={`grid grid-cols-2 gap-1.5 @lg:grid-cols-4 ${compact ? "mb-3" : "mb-5"}`}>
      {ESSENTIALS.map((item) => (
        <div
          key={item.label}
          className={`rounded-[3px] ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}
          style={{
            background: "linear-gradient(176deg,#fffaf0,#f3e7cd)",
            boxShadow: "inset 0 0 0 1px rgba(168,112,31,.3)",
          }}
        >
          <div className="u-label text-ink-500">{item.label}</div>
          <div className={`u-display leading-tight text-ink-900 ${compact ? "text-[15px]" : "text-[19px]"}`}>
            {item.value}
          </div>
          <div className={`leading-tight text-ink-500 ${compact ? "text-[10px]" : "text-[10.5px]"}`}>{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

function Rule({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  const compact = useCompact();
  return (
    <section
      className={`mb-2 break-inside-avoid rounded-[3px] ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}
      style={{
        background: "rgba(255,252,244,.62)",
        boxShadow: "inset 0 0 0 1px rgba(110,86,52,.2), 0 1px 0 rgba(255,255,255,.7)",
      }}
    >
      <h3 className="mb-1 flex items-center gap-2">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full text-gold-700 ${
            compact ? "h-5 w-5" : "h-6 w-6"
          }`}
          style={{ background: "rgba(205,161,88,.18)", boxShadow: "inset 0 0 0 1px rgba(168,112,31,.3)" }}
        >
          <Icon name={icon} size={compact ? 11 : 13} />
        </span>
        <span className={`u-display text-ink-900 ${compact ? "text-[13px]" : "text-[14.5px]"}`}>{title}</span>
      </h3>
      <ul
        className={`flex list-none flex-col gap-1 leading-snug text-ink-700 ${
          compact ? "text-[11px]" : "text-[12.5px]"
        } [&>li]:relative [&>li]:pl-3 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.55em] [&>li]:before:h-1 [&>li]:before:w-1 [&>li]:before:rounded-full [&>li]:before:bg-gold-700/60 [&>li]:before:content-['']`}
      >
        {children}
      </ul>
    </section>
  );
}

/**
 * The rules as this board applies them, one card per question a player
 * actually has mid-game. The quick-reference strip on top answers the
 * number they came for without making them read a paragraph to find it.
 */
export function RulesTab() {
  return (
    <div className="@container">
      <Essentials />

      <div className="columns-1 gap-2 @lg:columns-2">
        <Rule title="Le tour" icon="dice">
          <li>Lancez les dés, avancez, puis résolvez la case où vous vous arrêtez.</li>
          <li>
            Un double vous fait rejouer. <b>Trois doubles d'affilée</b> vous envoient directement en prison.
          </li>
          <li>
            Passer par le Départ rapporte 200 F. Tomber <b>pile</b> dessus rapporte le double.
          </li>
        </Rule>

        <Rule title="Acheter un bien" icon="deed">
          <li>Sur une case libre, vous pouvez l'acheter au prix affiché.</li>
          <li>
            Si vous refusez, elle part <b>obligatoirement aux enchères</b>, ouvertes à tous — vous compris. Les
            mises partent de zéro et le plus offrant l'emporte.
          </li>
        </Rule>

        <Rule title="Les loyers" icon="coins">
          <li>
            Terrain nu : loyer de base, <b>doublé</b> si le propriétaire détient tout le groupe.
          </li>
          <li>Avec des bâtiments : le barème inscrit sur le titre de propriété.</li>
          <li>Un bien hypothéqué ne rapporte aucun loyer.</li>
          <li>Vous encaissez vos loyers même depuis la prison.</li>
        </Rule>

        <Rule title="Construire" icon="hammer">
          <li>
            Ouvrez <b>Patrimoine</b> dans la barre du bas, pendant votre tour : le marteau construit, le moins
            revend.
          </li>
          <li>
            Il faut posséder <b>tout le groupe</b>, sans aucune hypothèque dessus.
          </li>
          <li>
            Construction <b>uniforme</b> : jamais plus d'une maison d'écart entre deux rues du même groupe.
          </li>
          <li>La 5ᵉ maison devient un hôtel.</li>
          <li>
            La banque n'a que <b>32 maisons et 12 hôtels</b>. Stock épuisé, plus personne ne construit.
          </li>
        </Rule>

        <Rule title="Hypothéquer" icon="bank">
          <li>Une hypothèque rapporte la moitié du prix d'achat du bien.</li>
          <li>Il faut d'abord revendre tous les bâtiments du groupe.</li>
          <li>La lever coûte la moitié du prix, majorée de 10 %.</li>
        </Rule>

        <Rule title="La prison" icon="jail">
          <li>On y va par la case « Allez en prison », par une carte, ou après trois doubles.</li>
          <li>Pour sortir : faire un double (trois tentatives), payer 50 F, ou utiliser une carte de sortie.</li>
          <li>Après trois échecs, l'amende de 50 F est prélevée et vous sortez.</li>
        </Rule>

        <Rule title="Échanger" icon="exchange">
          <li>Argent et propriétés, dans les deux sens, avec n'importe quel joueur.</li>
          <li>Un bien qui porte des bâtiments ne s'échange pas : vendez-les d'abord.</li>
          <li>En ligne, l'autre joueur accepte ou refuse depuis son propre appareil.</li>
        </Rule>

        <Rule title="La faillite" icon="warning">
          <li>Si vous devez plus que vos liquidités, vendez des bâtiments ou hypothéquez pour réunir la somme.</li>
          <li>
            Sinon c'est la faillite : envers un joueur, il récupère tout ; envers la banque, vos biens repartent aux
            enchères.
          </li>
          <li>Le dernier joueur encore debout remporte la partie.</li>
        </Rule>

        <Rule title="Abandonner" icon="flag">
          <li>
            Depuis <b>Quitter la partie</b>, vous pouvez abandonner à tout moment, sauf pendant une enchère ou avec
            une carte ou une dette en cours.
          </li>
          <li>
            Vos billets et la valeur de vos maisons sont <b>partagés entre les joueurs restants</b> ; vos titres
            retournent à la banque, libres à l'achat.
          </li>
          <li>S'il ne reste qu'un joueur, il remporte la partie.</li>
        </Rule>
      </div>
    </div>
  );
}
