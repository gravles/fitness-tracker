import { toast } from 'sonner';
import type { Partnership } from '@/lib/partner-api';
import type { TranslationDict } from '@/lib/i18n/translations';

/** Toasts for a tag-while-logging share: who got it, and why anything failed. */
export function notifyShareResult(sent: Partnership[], error: unknown, t: TranslationDict) {
    if (sent.length > 0) {
        toast.success(t.partner.logShare.sharedWith(sent.map(p => p.otherName || p.invitee_email).join(', ')));
    }
    if (error) {
        // 23514 = check violation: the logged_* share types need partner_log_share_migration.sql
        const code = (error as { code?: string }).code;
        toast.error(code === '23514' ? t.partner.logShare.migrationNeeded : 'Failed to share with partner');
    }
}
