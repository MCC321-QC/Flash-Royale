import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { useWindowDrag } from "./WindowTitleBar";
import type { Language } from "./i18n";

type ExternalLinkText = { message: string; controller: string; open: string; cancel: string };

const externalLinkLabels: Record<Language, ExternalLinkText> = {
  en: { message: "This link leaves Flash Royale and opens in your web browser. Only continue if you trust this address:", controller: "Controller navigation doesn't work in the browser, so you may need a mouse and keyboard.", open: "Open link", cancel: "Cancel" },
  fr: { message: "Ce lien vous fait quitter Flash Royale et s'ouvre dans votre navigateur web. Ne continuez que si vous faites confiance à cette adresse :", controller: "La navigation à la manette ne fonctionne pas dans le navigateur. Vous pourriez donc avoir besoin d'une souris et d'un clavier.", open: "Ouvrir le lien", cancel: "Annuler" },
  zh: { message: "此链接将离开 Flash Royale，在你的网页浏览器中打开。请仅在信任以下地址时继续：", controller: "浏览器不支持手柄导航，因此你可能需要使用鼠标和键盘。", open: "打开链接", cancel: "取消" },
  es: { message: "Este enlace te lleva fuera de Flash Royale y se abre en tu navegador web. Continúa únicamente si confías en esta dirección:", controller: "La navegación con mando no funciona en el navegador, por lo que podrías necesitar un ratón y un teclado.", open: "Abrir enlace", cancel: "Cancelar" },
  de: { message: "Dieser Link führt aus Flash Royale heraus und wird in deinem Webbrowser geöffnet. Fahre nur fort, wenn du der folgenden Adresse vertraust:", controller: "Die Controller-Navigation funktioniert im Browser nicht. Du benötigst daher möglicherweise eine Maus und eine Tastatur.", open: "Link öffnen", cancel: "Abbrechen" },
  "pt-BR": { message: "Este link leva você para fora do Flash Royale e abre no navegador. Só continue se confiar neste endereço:", controller: "A navegação com controle não funciona no navegador, então você pode precisar de mouse e teclado.", open: "Abrir link", cancel: "Cancelar" },
  ja: { message: "このリンクを開くと Flash Royale を離れ、ウェブブラウザーに移動します。次のアドレスを信頼できる場合にのみ続行してください：", controller: "ブラウザーではコントローラーによるナビゲーションが機能しないため、マウスとキーボードが必要になる場合があります。", open: "リンクを開く", cancel: "キャンセル" },
  ko: { message: "이 링크는 Flash Royale을 나가 웹 브라우저에서 열립니다. 다음 주소를 신뢰할 때만 계속하세요:", controller: "브라우저에서는 컨트롤러 탐색을 사용할 수 없으므로 마우스와 키보드가 필요할 수 있습니다.", open: "링크 열기", cancel: "취소" },
  hi: { message: "यह लिंक Flash Royale से बाहर आपके वेब ब्राउज़र में खुलेगा। आगे केवल तभी बढ़ें जब आपको इस पते पर भरोसा हो:", controller: "ब्राउज़र में कंट्रोलर से नेविगेशन काम नहीं करता, इसलिए आपको माउस और कीबोर्ड की आवश्यकता हो सकती है।", open: "लिंक खोलें", cancel: "रद्द करें" },
  ar: { message: "ينقلك هذا الرابط إلى خارج Flash Royale ويُفتح في متصفح الويب. لا تتابع إلا إذا كنت تثق بهذا العنوان:", controller: "لا يعمل التنقل باستخدام وحدة التحكم في المتصفح، ولذلك قد تحتاج إلى فأرة ولوحة مفاتيح.", open: "فتح الرابط", cancel: "إلغاء" },
  ru: { message: "Эта ссылка ведёт за пределы Flash Royale и откроется в вашем веб-браузере. Продолжайте только в том случае, если доверяете этому адресу:", controller: "Навигация с помощью контроллера в браузере не работает, поэтому вам могут потребоваться мышь и клавиатура.", open: "Открыть ссылку", cancel: "Отмена" },
};

/** The address under the warning, with the site name standing out so look-alike links are easier to spot. */
function LinkAddress({ url }: { url: string }) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {}
  return (
    <p className="confirm-link" dir="ltr">
      <ExternalLink size={16} aria-hidden="true" />
      <span>{host && <strong>{host}</strong>}<span className="confirm-link-url">{url}</span></span>
    </p>
  );
}

export function ExternalLinkDialog({ url, language, controller, onResolve }: {
  url: string;
  language: Language;
  controller: boolean;
  onResolve: (confirmed: boolean) => void;
}) {
  const text = externalLinkLabels[language] ?? externalLinkLabels.en;
  return (
    <ConfirmationDialog
      message={text.message}
      detail={<>
        <LinkAddress url={url} />
        {controller && <p className="confirm-link-note">{text.controller}</p>}
      </>}
      confirmLabel={text.open}
      cancelLabel={text.cancel}
      onResolve={onResolve}
      backdropClassName="confirm-link-backdrop"
    />
  );
}

/** The small window main opens to confirm links from pages that can't show Flash Royale dialogs (Y8 online games). */
export function ExternalLinkWindow({ id, language }: { id: string; language: Language }) {
  const drag = useWindowDrag();
  const root = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [controller, setController] = useState(() => document.documentElement.classList.contains("controller-navigation-active"));
  useEffect(() => {
    void window.flashApi.getExternalLinkRequest?.(id).then((value) => {
      if (value) setUrl(value);
      else window.close();
    });
    const observer = new MutationObserver(() => setController(document.documentElement.classList.contains("controller-navigation-active")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [id]);
  if (!url) return null;
  return <div ref={root} className="external-link-window" {...drag} onPointerDown={(event) => {
    if ((event.target as Element).closest("#confirm-message")) drag.onPointerDown(event);
  }} onDoubleClick={(event) => {
    if ((event.target as Element).closest("#confirm-message")) drag.onDoubleClick(event);
  }}>
    <ExternalLinkDialog url={url} language={language} controller={controller} onResolve={(confirmed) => {
      void window.flashApi.resolveExternalLink?.(id, confirmed).finally(() => window.close());
    }} />
  </div>;
}
