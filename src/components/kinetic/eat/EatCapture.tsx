'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Camera, Barcode, Keyboard, ChefHat, Heart, Loader2, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal } from '@/components/ui';
import { VoiceInput } from '@/components/VoiceInput';
import { FoodCamera } from '@/components/FoodCamera';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { TextLogModal } from '@/components/TextLogModal';
import { MenuScanner } from '@/components/MenuScanner';
import { FoodSelector } from '@/components/FoodSelector';
import { WorkoutChatModal } from '@/components/WorkoutChatModal';
import { appendFoodItems, getDailyLog, upsertDailyLog, addWorkout, FoodItem, FoodSource } from '@/lib/api';
import { checkAndAwardBadges } from '@/lib/badges';
import { haptics } from '@/lib/haptics';
import { authHeaders } from '@/lib/supabase';

export type CaptureAction = 'voice' | 'camera' | 'barcode' | 'text' | 'scan' | 'favorites';

/** Shape of /api/ai/process-intent responses (voice + text log flows) */
interface CaptureIntent {
  error?: string;
  intent?: string;
  original?: string;
  data?: {
    items?: (FoodItem & { alcohol_units?: number })[];
    item?: string;
  };
}

type NewWorkout = Parameters<typeof addWorkout>[0];

interface EatCaptureProps {
  dateStr: string;
  /** Deep-linked action (/nutrition?action=…) to auto-open on mount */
  initialAction?: CaptureAction | null;
  /** Called after anything is logged so the feed refreshes */
  onLogged: () => void | Promise<void>;
}

const tileStyle: React.CSSProperties = {
  borderRadius: 14,
  background: 'var(--color-gold-muted)',
  border: '1px solid var(--color-gold-border)',
};

/**
 * The Eat screen's capture hub — voice, snap, barcode, type, menu scan, and
 * favorites/recent/saved meals — writing straight into the day's log via
 * appendFoodItems. Replaces the old /log NutritionSection capture grid.
 */
export function EatCapture({ dateStr, initialAction = null, onLogged }: EatCaptureProps) {
  const { t } = useLanguage();
  const [showCamera, setShowCamera] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showWorkoutChat, setShowWorkoutChat] = useState(false);
  const [chatInitialInput, setChatInitialInput] = useState('');
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const appliedAction = useRef(false);

  useEffect(() => {
    if (!initialAction || appliedAction.current) return;
    appliedAction.current = true;
    if (initialAction === 'voice') setAutoStartVoice(true);
    else if (initialAction === 'camera') setShowCamera(true);
    else if (initialAction === 'barcode') setShowBarcode(true);
    else if (initialAction === 'text') setShowText(true);
    else if (initialAction === 'scan') setShowMenu(true);
    else if (initialAction === 'favorites') setShowFavorites(true);
  }, [initialAction]);

  async function logItems(items: FoodItem[], source: FoodSource) {
    const stamped: FoodItem[] = items.map(i => ({ ...i, source: i.source ?? source }));
    await appendFoodItems(dateStr, stamped);
    haptics.success();
    await onLogged();
    checkAndAwardBadges();
  }

  /** Bump the day's drink count (voice/photo flows can detect alcohol) */
  async function addDrinks(units: number) {
    const log = await getDailyLog(dateStr).catch(() => null);
    await upsertDailyLog({ date: dateStr, alcohol_drinks: (log?.alcohol_drinks ?? 0) + units });
  }

  /** Append free text to the day's note when no food was detected */
  async function appendNote(text: string) {
    const log = await getDailyLog(dateStr).catch(() => null);
    const note = [log?.daily_note, text].filter(Boolean).join(' ');
    await upsertDailyLog({ date: dateStr, daily_note: note });
  }

  async function handleIntent(intent: CaptureIntent) {
    if (intent.error) {
      toast.error('Voice Error: ' + intent.error);
      return;
    }
    if (intent.intent === 'log_food') {
      if (intent.data?.items) {
        let alcoholAdded = 0;
        const items = intent.data.items.map(i => {
          if (i.alcohol_units) alcoholAdded += i.alcohol_units;
          return i;
        });
        await logItems(items, 'voice');
        if (alcoholAdded > 0) {
          await addDrinks(alcoholAdded);
          await onLogged();
          toast.success(`Added: ${items.map(i => i.name).join(', ')} (and +${alcoholAdded} standard drinks)`);
        } else {
          toast.success(`Added: ${items.map(i => i.name).join(', ')}`);
        }
      } else if (intent.data?.item) {
        await appendNote(intent.data.item);
        toast('Voice text added to the day note (no items detected)');
      }
    } else if (intent.intent === 'log_workout') {
      setChatInitialInput(intent.original || '');
      setShowWorkoutChat(true);
    } else {
      toast.error(`Could not understand: "${intent.original}"`);
    }
  }

  const staticTiles = [
    { icon: Camera, ariaLabel: 'Snap a photo of your meal', open: () => setShowCamera(true) },
    { icon: Barcode, ariaLabel: 'Scan a barcode', open: () => setShowBarcode(true) },
    { icon: Keyboard, ariaLabel: 'Type what you ate', open: () => setShowText(true) },
    { icon: ChefHat, ariaLabel: 'Scan a restaurant menu', open: () => setShowMenu(true) },
    { icon: Heart, ariaLabel: 'Favorites, recent & saved meals', open: () => setShowFavorites(true) },
  ];

  return (
    <>
      {/* Compact capture bar — voice tile first, with live listening state */}
      <div className="flex justify-between gap-1.5">
        <VoiceInput
          autoStart={autoStartVoice}
          onStateChange={(listening, processing) => setVoiceBusy(listening || processing)}
          onIntentDetected={handleIntent}
          customTrigger={(onClick, isListening, isProcessing) => (
            <button
              onClick={onClick}
              disabled={isProcessing}
              aria-label="Log with voice"
              title="Log with voice"
              className="flex-1 flex items-center justify-center tap-target focus-ring transition-kinetic active:scale-[0.95]"
              style={isListening ? { ...tileStyle, background: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : tileStyle}
            >
              {isProcessing
                ? <Loader2 className="w-[18px] h-[18px] animate-spin" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
                : <Mic className="w-[18px] h-[18px]" style={{ color: isListening ? '#fff' : 'var(--color-gold-text)' }} aria-hidden="true" />}
            </button>
          )}
        />
        {staticTiles.map(({ icon: Icon, ariaLabel, open }) => (
          <button
            key={ariaLabel}
            onClick={open}
            aria-label={ariaLabel}
            title={ariaLabel}
            className="flex-1 flex items-center justify-center tap-target focus-ring transition-kinetic active:scale-[0.95]"
            style={tileStyle}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
          </button>
        ))}
      </div>
      {voiceBusy && (
        <p role="status" className="mt-1.5 text-center text-[10px] font-bold" style={{ color: 'var(--color-gold-text)' }}>
          {t.nutrition.listening}
        </p>
      )}

      {/* ── Capture flows ── */}
      {showCamera && (
        <Modal isOpen onClose={() => setShowCamera(false)} aria-label={t.dashboard.snapMeal} size="sm">
          <FoodCamera
            autoStart
            onClose={() => setShowCamera(false)}
            onCapture={async (img) => {
              setShowCamera(false);
              setLoadingAI(true);
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);
              try {
                const res = await fetch('/api/ai/analyze-food', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                  body: JSON.stringify({ image: img }),
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
                await logItems([{
                  name: data.name || 'Scanned Meal',
                  calories: data.calories,
                  protein: data.protein,
                  carbs: data.carbs,
                  fat: data.fat,
                }], 'photo');
                if (data.alcohol_units && data.alcohol_units > 0) {
                  await addDrinks(data.alcohol_units);
                  await onLogged();
                  toast.success(`Logged '${data.name}' and added +${data.alcohol_units} standard drinks.`);
                } else {
                  toast.success(`Logged '${data.name}'`);
                }
              } catch (err) {
                clearTimeout(timeoutId);
                console.error(err);
                const e = err as { name?: string; message?: string };
                toast.error(e.name === 'AbortError'
                  ? 'Analysis timed out. Please try again.'
                  : 'AI Error: ' + (e.message || 'Failed to analyze food.'));
              } finally {
                setLoadingAI(false);
              }
            }}
          />
        </Modal>
      )}

      {showBarcode && (
        <Modal isOpen onClose={() => setShowBarcode(false)} aria-label={t.dashboard.barcode} size="sm">
          <BarcodeScanner
            onResult={async (food) => {
              setShowBarcode(false);
              await logItems([{ ...food, quantity: 1 }], 'barcode');
              toast.success(`Logged '${food.name}'`);
            }}
            onClose={() => setShowBarcode(false)}
          />
        </Modal>
      )}

      <TextLogModal
        isOpen={showText}
        onClose={() => setShowText(false)}
        onProcessed={async (intent) => {
          setShowText(false);
          await handleIntent(intent);
        }}
        onWorkoutRequest={(text) => {
          setShowText(false);
          setChatInitialInput(text);
          setShowWorkoutChat(true);
        }}
      />

      {showMenu && (
        <MenuScanner
          onClose={() => setShowMenu(false)}
          onLog={async (item) => {
            setShowMenu(false);
            await logItems([item], 'manual');
            toast.success(`Logged '${item.name}'`);
          }}
        />
      )}

      {showFavorites && (
        <FoodSelector
          onClose={() => setShowFavorites(false)}
          onSelect={async (items: FoodItem[]) => {
            setShowFavorites(false);
            await logItems(items, 'manual');
            toast.success(`Added: ${items.map(i => i.name).join(', ')}`);
          }}
        />
      )}

      <WorkoutChatModal
        isOpen={showWorkoutChat}
        onClose={() => setShowWorkoutChat(false)}
        initialData={chatInitialInput}
        onSave={async (workout: NewWorkout) => {
          try {
            await addWorkout({ ...workout, date: dateStr });
            haptics.success();
            toast.success(`Logged workout: ${workout.activity_type}`);
            await onLogged();
            checkAndAwardBadges();
          } catch (e) {
            console.error(e);
            toast.error('Failed to save workout');
          }
        }}
      />

      {loadingAI && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)', backdropFilter: 'blur(4px)', color: 'var(--color-primary)' }}
        >
          <Brain className="w-8 h-8 animate-pulse mb-2" aria-hidden="true" />
          <p className="text-sm font-bold animate-pulse">{t.nutrition.analyzingFood}</p>
        </div>
      )}
    </>
  );
}
