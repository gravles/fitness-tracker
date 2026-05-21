'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, Loader2, ChevronLeft, ChevronRight, Trash2, Plus, X, Scale } from 'lucide-react';
import { ProgressPhoto, uploadProgressPhoto, getProgressPhotos, deleteProgressPhoto } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

export default function ProgressPage() {
    const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [compareIndex, setCompareIndex] = useState<number>(0);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadWeight, setUploadWeight] = useState<string>('');
    const [uploadNotes, setUploadNotes] = useState<string>('');

    useEffect(() => {
        loadPhotos();
    }, []);

    async function loadPhotos() {
        try {
            const data = await getProgressPhotos();
            setPhotos(data);
        } catch (error) {
            console.error('Failed to load photos', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload() {
        if (!uploadFile) return;

        setUploading(true);
        haptics.tap();

        try {
            const newPhoto = await uploadProgressPhoto(uploadFile, {
                weight: uploadWeight ? parseFloat(uploadWeight) : undefined,
                notes: uploadNotes || undefined,
            });

            setPhotos([newPhoto, ...photos]);
            haptics.success();
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadWeight('');
            setUploadNotes('');
        } catch (error) {
            console.error('Upload failed', error);
            haptics.error();
            toast.error('Failed to upload photo. Please try again.');
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this progress photo?')) return;

        haptics.tap();
        try {
            await deleteProgressPhoto(id);
            setPhotos(photos.filter(p => p.id !== id));
            setSelectedIndex(null);
            haptics.success();
        } catch (error) {
            console.error('Delete failed', error);
            haptics.error();
        }
    }

    const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;
    const comparePhoto = photos[compareIndex];

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                    </Link>
                    <h1 className="font-bold text-[var(--color-text)]">Progress Photos</h1>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="p-2 -mr-2 rounded-full bg-[var(--color-primary)] text-white"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : photos.length === 0 ? (
                    <div className="text-center py-20">
                        <Camera className="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4" />
                        <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">No Progress Photos Yet</h2>
                        <p className="text-[var(--color-text-muted)] mb-6">
                            Take your first photo to start tracking your journey
                        </p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold"
                        >
                            Add First Photo
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Compare Toggle */}
                        {photos.length >= 2 && (
                            <div className="mb-4 flex items-center justify-between">
                                <span className="text-sm text-[var(--color-text-muted)]">
                                    {photos.length} photos
                                </span>
                                <button
                                    onClick={() => setCompareMode(!compareMode)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${compareMode
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'bg-[var(--color-surface-elevated)] text-[var(--color-text)]'
                                        }`}
                                >
                                    {compareMode ? 'Exit Compare' : 'Compare'}
                                </button>
                            </div>
                        )}

                        {/* Compare View */}
                        {compareMode && photos.length >= 2 && (
                            <div className="mb-6 p-4 bg-[var(--color-surface-elevated)] rounded-2xl">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-[var(--color-text-muted)] mb-2">
                                            {format(parseISO(photos[0].created_at), 'MMM d, yyyy')}
                                        </p>
                                        <img
                                            src={photos[0].photo_url}
                                            alt="Latest"
                                            className="w-full aspect-[3/4] object-cover rounded-xl"
                                        />
                                        {photos[0].weight_at_capture && (
                                            <p className="text-center mt-2 text-sm font-bold text-[var(--color-text)]">
                                                {photos[0].weight_at_capture} lbs
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs text-[var(--color-text-muted)] mb-2">
                                            {format(parseISO(comparePhoto.created_at), 'MMM d, yyyy')}
                                        </p>
                                        <img
                                            src={comparePhoto.photo_url}
                                            alt="Compare"
                                            className="w-full aspect-[3/4] object-cover rounded-xl"
                                        />
                                        {comparePhoto.weight_at_capture && (
                                            <p className="text-center mt-2 text-sm font-bold text-[var(--color-text)]">
                                                {comparePhoto.weight_at_capture} lbs
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline slider */}
                                <div className="mt-4">
                                    <input
                                        type="range"
                                        min={1}
                                        max={photos.length - 1}
                                        value={compareIndex}
                                        onChange={(e) => setCompareIndex(Number(e.target.value))}
                                        className="w-full accent-[var(--color-primary)]"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Photo Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            {photos.map((photo, idx) => (
                                <button
                                    key={photo.id}
                                    onClick={() => {
                                        haptics.tap();
                                        setSelectedIndex(idx);
                                    }}
                                    className="relative aspect-square rounded-xl overflow-hidden group"
                                >
                                    <img
                                        src={photo.photo_url}
                                        alt={`Progress ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    />
                                    {photo.weight_at_capture && (
                                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                            {photo.weight_at_capture}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Photo Detail Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
                    <div className="flex justify-between items-center p-4">
                        <button
                            onClick={() => setSelectedIndex(null)}
                            className="p-2 text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <span className="text-white text-sm">
                            {format(parseISO(selectedPhoto.created_at), 'MMM d, yyyy')}
                        </span>
                        <button
                            onClick={() => handleDelete(selectedPhoto.id)}
                            className="p-2 text-red-400"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4">
                        <img
                            src={selectedPhoto.photo_url}
                            alt="Progress"
                            className="max-h-full max-w-full object-contain rounded-xl"
                        />
                    </div>

                    {(selectedPhoto.weight_at_capture || selectedPhoto.notes) && (
                        <div className="p-4 bg-black/50">
                            {selectedPhoto.weight_at_capture && (
                                <div className="flex items-center gap-2 text-white mb-2">
                                    <Scale className="w-4 h-4" />
                                    <span>{selectedPhoto.weight_at_capture} lbs</span>
                                </div>
                            )}
                            {selectedPhoto.notes && (
                                <p className="text-white/70 text-sm">{selectedPhoto.notes}</p>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    {photos.length > 1 && selectedIndex !== null && (
                        <>
                            {selectedIndex > 0 && (
                                <button
                                    onClick={() => setSelectedIndex(selectedIndex - 1)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full"
                                >
                                    <ChevronLeft className="w-6 h-6 text-white" />
                                </button>
                            )}
                            {selectedIndex < photos.length - 1 && (
                                <button
                                    onClick={() => setSelectedIndex(selectedIndex + 1)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full"
                                >
                                    <ChevronRight className="w-6 h-6 text-white" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h3 className="font-bold text-[var(--color-text)]">Add Progress Photo</h3>
                            <button onClick={() => setShowUploadModal(false)} className="p-2">
                                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* File picker */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-video border-2 border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[var(--color-primary)] transition-colors overflow-hidden"
                            >
                                {uploadFile ? (
                                    <img
                                        src={URL.createObjectURL(uploadFile)}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <>
                                        <Camera className="w-8 h-8 text-[var(--color-text-muted)]" />
                                        <span className="text-sm text-[var(--color-text-muted)]">Tap to select photo</span>
                                    </>
                                )}
                            </button>

                            {/* Weight input */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                    Weight (optional)
                                </label>
                                <div className="relative">
                                    <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                    <input
                                        type="number"
                                        value={uploadWeight}
                                        onChange={(e) => setUploadWeight(e.target.value)}
                                        placeholder="Enter weight"
                                        className="w-full pl-10 pr-12 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)]"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">lbs</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                    Notes (optional)
                                </label>
                                <textarea
                                    value={uploadNotes}
                                    onChange={(e) => setUploadNotes(e.target.value)}
                                    placeholder="How are you feeling?"
                                    rows={2}
                                    className="w-full p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--color-border)]">
                            <button
                                onClick={handleUpload}
                                disabled={!uploadFile || uploading}
                                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Photo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
