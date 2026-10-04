import React from 'react';
import { X, Gamepad2, Mouse, Compass, Heart, ShieldAlert } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = React.memo(({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs select-none">
      <div className="mc-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-5 flex flex-col gap-4 text-stone-900 animate-scale-in">
        <div className="flex items-center justify-between border-b-2 border-stone-400 pb-2">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-stone-800" />
            <h2 className="font-pixel text-2xl text-stone-900 font-bold tracking-wider">
              OYUN REHBERİ VE KONTROLLER
            </h2>
          </div>
          <button onClick={onClose} className="p-1 mc-btn rounded text-stone-800 hover:text-red-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Touch Controls (Mobile) Section */}
        <div className="bg-stone-500/20 rounded-lg p-3 border border-stone-400">
          <div className="flex items-center gap-2 mb-2 text-stone-900 font-bold font-pixel text-base">
            <Gamepad2 className="w-5 h-5 text-amber-700" />
            <span>DOKUNMATİK SAĞ EL KONTROLLERİ</span>
          </div>
          <ul className="text-sm font-pixel text-stone-800 space-y-1.5 list-disc list-inside">
            <li>
              <b className="text-amber-800">Sağ Taraf Joystick:</b> Baş parmağınızla ileri, geri, sola ve sağa hareket edin.
            </li>
            <li>
              <b className="text-sky-700">ZIPLA Tuşu:</b> Zıplar, sudayken yukarı yüzer.
            </li>
            <li>
              <b className="text-amber-700">ÇÖMEL Tuşu:</b> Eğilir, blok kenarlarından düşmenizi engeller!
            </li>
            <li>
              <b className="text-red-800">EL / KAZ Tuşu:</b> Basılı tutarak bloğu kırın, moblara vurarak saldırın.
            </li>
            <li>
              <b className="text-emerald-700">KOY Tuşu:</b> Elinizdeki bloğu hedeflenen yere yerleştirir.
            </li>
            <li>
              <b className="text-indigo-800">Sol Ekran Alanı:</b> Parmağınızı kaydırarak kamerayı çevirin ve etrafa bakın.
            </li>
          </ul>
        </div>

        {/* Desktop Controls */}
        <div className="bg-stone-500/20 rounded-lg p-3 border border-stone-400">
          <div className="flex items-center gap-2 mb-2 text-stone-900 font-bold font-pixel text-base">
            <Mouse className="w-5 h-5 text-sky-700" />
            <span>KLAVYE VE FARE KONTROLLERİ (MASAÜSTÜ)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-pixel text-stone-800">
            <div><b>W, A, S, D:</b> Yürüme</div>
            <div><b>Boşluk (Space):</b> Zıplama / Yüzme</div>
            <div><b>Sol Shift:</b> Çömelme (Eğilme)</div>
            <div><b>Sol Tık:</b> Blok Kazma / Vurma</div>
            <div><b>Sağ Tık:</b> Blok Koyma / Etkileşim</div>
            <div><b>1 - 9 / Tekerlek:</b> Eşya Seçimi</div>
            <div><b>E Tuşu:</b> Çanta ve Zanaat</div>
            <div><b>Ekran Tıklaması:</b> Fareyi Kilitle (Pointer Lock)</div>
          </div>
        </div>

        {/* Survival Tips */}
        <div className="bg-amber-100/50 rounded-lg p-3 border border-amber-300">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold font-pixel text-base">
            <Heart className="w-5 h-5 text-red-600" />
            <span>HAYATTA KALMA İPUÇLARI</span>
          </div>
          <p className="text-xs font-pixel text-amber-950 leading-relaxed">
            1. Ağaçları keserek meşe odunu toplayın, tahta ve çubuk üretin.<br />
            2. Çantadan Çalışma Masası yapın; kazma, kılıç ve balta üretin.<br />
            3. Yerin altına inerek kömür, demir ve elmas cevherleri keşfedin.<br />
            4. Açlık barınız düşerse elma veya domuz eti yiyin, canınız yenilensin.<br />
            5. Gece olduğunda zombilere karşı hazırlıklı olun veya meşale dikerek aydınlatın!
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 mc-btn rounded-lg font-pixel text-lg text-white font-bold tracking-wider"
        >
          ANLADIM, OYUNA DÖN
        </button>
      </div>
    </div>
  );
});
