-- ============================================================================
-- PARTNER LOG SHARING MIGRATION
-- ============================================================================
-- Lets partners share meals they ate and activities they did together, so the
-- other person can copy them straight into their own log. Run in the Supabase
-- SQL editor BEFORE deploying the feature. Idempotent and non-destructive:
-- it only widens the allowed item_type values on partner_shared_items.
-- ============================================================================

ALTER TABLE partner_shared_items
    DROP CONSTRAINT IF EXISTS partner_shared_items_item_type_check;

ALTER TABLE partner_shared_items
    ADD CONSTRAINT partner_shared_items_item_type_check
    CHECK (item_type IN (
        'workout_template', 'saved_meal', 'favorite_food',
        'logged_meal', 'logged_activity'
    ));
