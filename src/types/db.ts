// Hand-authored to match supabase/migrations/*.sql.
// TODO(mouheb): once a Supabase project is linked, regenerate with
//   `supabase gen types typescript --linked > src/types/db.ts`
// and delete this notice. Shape mirrors `supabase gen types` output.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          has_paid: boolean | null;
          is_admin: boolean;
          payment_status: string;
          locale: string | null;
          phone: string | null;
          contacted_at: string | null;
          contacted_by: string | null;
          plan_type: string | null;
          plan_expires_at: string | null;
          payment_ref: string | null;
          paid_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          has_paid?: boolean | null;
          is_admin?: boolean;
          payment_status?: string;
          locale?: string | null;
          phone?: string | null;
          contacted_at?: string | null;
          contacted_by?: string | null;
          plan_type?: string | null;
          plan_expires_at?: string | null;
          payment_ref?: string | null;
          paid_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          has_paid?: boolean | null;
          is_admin?: boolean;
          payment_status?: string;
          locale?: string | null;
          phone?: string | null;
          contacted_at?: string | null;
          contacted_by?: string | null;
          plan_type?: string | null;
          plan_expires_at?: string | null;
          payment_ref?: string | null;
          paid_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payment_settings: {
        Row: {
          id: number;
          price_tnd: number;
          compare_at_tnd: number | null;
          offer_label_en: string | null;
          offer_label_ar: string | null;
          whatsapp_number: string | null;
          whatsapp_message_en: string | null;
          whatsapp_message_ar: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          price_tnd?: number;
          compare_at_tnd?: number | null;
          offer_label_en?: string | null;
          offer_label_ar?: string | null;
          whatsapp_number?: string | null;
          whatsapp_message_en?: string | null;
          whatsapp_message_ar?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          price_tnd?: number;
          compare_at_tnd?: number | null;
          offer_label_en?: string | null;
          offer_label_ar?: string | null;
          whatsapp_number?: string | null;
          whatsapp_message_en?: string | null;
          whatsapp_message_ar?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          key: string;
          is_enabled: boolean;
          order_index: number;
          label_en: string;
          label_ar: string;
          account_value: string | null;
          instructions_en: string | null;
          instructions_ar: string | null;
          /** One line under the account number. Migration 048. */
          hint_en: string | null;
          hint_ar: string | null;
          /** Brand logo; null falls back to a monogram tile. Migration 048. */
          logo_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          is_enabled?: boolean;
          order_index?: number;
          label_en: string;
          label_ar: string;
          account_value?: string | null;
          instructions_en?: string | null;
          instructions_ar?: string | null;
          hint_en?: string | null;
          hint_ar?: string | null;
          logo_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          is_enabled?: boolean;
          order_index?: number;
          label_en?: string;
          label_ar?: string;
          account_value?: string | null;
          instructions_en?: string | null;
          instructions_ar?: string | null;
          hint_en?: string | null;
          hint_ar?: string | null;
          logo_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      copy_overrides: {
        Row: {
          key: string;
          locale: string;
          value: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          locale: string;
          value: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          locale?: string;
          value?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      payment_requests: {
        Row: {
          id: string;
          user_id: string;
          method_key: string;
          amount_tnd: number;
          plan_tier: string | null;
          plan_months: number | null;
          status: string;
          created_at: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          proof_path: string | null;
          proof_note: string | null;
          proof_uploaded_at: string | null;
          // migration 044 — drives the admin nav's unread payments badge
          admin_seen_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          method_key: string;
          amount_tnd: number;
          plan_tier?: string | null;
          plan_months?: number | null;
          status?: string;
          created_at?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          proof_path?: string | null;
          proof_note?: string | null;
          proof_uploaded_at?: string | null;
          admin_seen_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          method_key?: string;
          amount_tnd?: number;
          plan_tier?: string | null;
          plan_months?: number | null;
          status?: string;
          created_at?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          proof_path?: string | null;
          proof_note?: string | null;
          proof_uploaded_at?: string | null;
          admin_seen_at?: string | null;
        };
        Relationships: [];
      };
      diet_profiles: {
        Row: {
          id: string;
          user_id: string;
          version: number;
          is_active: boolean | null;
          gender: string | null;
          birth_date: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          goal: string | null;
          activity_level: string | null;
          meals_per_day: number | null;
          budget_level: string | null;
          allergies: string[] | null;
          dietary_restriction: string | null;
          disliked_foods: string[] | null;
          ramadan_mode: boolean;
          cooking_skill: string | null;
          favorite_foods: string[] | null;
          diet_intensity: string;
          // migration 028 — professional 20-question answers
          target_weight_kg: number | null;
          /**
           * Retired by migration 050. The simplified calculator uses neither a
           * self-reported body-fat CATEGORY nor a step band; both are kept for
           * the rows that already carry them and are never written anymore.
           */
          body_fat_level: string | null;
          daily_steps: string | null;
          /** migration 050 — measured %, the one body-fat input that is read. */
          body_fat_percent: number | null;
          training_days: string | null;
          training_time: string | null;
          cooking_pref: string | null;
          digestion: string[] | null;
          water_intake: string | null;
          supplements: string[] | null;
          tracking_experience: string | null;
          food_restrictions: string[] | null;
          avoid_foods: string[] | null;
          selected_template_code: string | null;
          // migration 043 — 'guided' (20-Q wizard) or 'custom' (hand-built)
          build_mode: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          version?: number;
          is_active?: boolean | null;
          gender?: string | null;
          birth_date?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          goal?: string | null;
          activity_level?: string | null;
          meals_per_day?: number | null;
          budget_level?: string | null;
          allergies?: string[] | null;
          dietary_restriction?: string | null;
          disliked_foods?: string[] | null;
          ramadan_mode?: boolean;
          cooking_skill?: string | null;
          favorite_foods?: string[] | null;
          diet_intensity?: string;
          target_weight_kg?: number | null;
          body_fat_level?: string | null;
          daily_steps?: string | null;
          body_fat_percent?: number | null;
          training_days?: string | null;
          training_time?: string | null;
          cooking_pref?: string | null;
          digestion?: string[] | null;
          water_intake?: string | null;
          supplements?: string[] | null;
          tracking_experience?: string | null;
          food_restrictions?: string[] | null;
          avoid_foods?: string[] | null;
          selected_template_code?: string | null;
          build_mode?: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["diet_profiles"]["Insert"]>;
        Relationships: [];
      };
      macro_targets: {
        Row: {
          id: string;
          diet_profile_id: string;
          bmr: number;
          tdee: number;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number;
          rationale_json: Json | null;
          computed_at: string | null;
        };
        Insert: {
          id?: string;
          diet_profile_id: string;
          bmr: number;
          tdee: number;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number;
          rationale_json?: Json | null;
          computed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["macro_targets"]["Insert"]>;
        Relationships: [];
      };
      // migration 028 — the large `foods` catalog + `recipes` and
      // `recipe_ingredients` were dropped and replaced by the curated
      // ingredient set below.
      //
      // migration 043 — `user_foods` (dropped along with them in 028) is
      // recreated, because the catalog is global and read-only and "the thing I
      // eat isn't in your list" needs somewhere private to land. Same column
      // vocabulary as nutrition_ingredients so one picker can render both.
      user_foods: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          name_ar: string | null;
          slot: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g: number;
          typical_serving_g: number | null;
          unit_en: string | null;
          unit_en_plural: string | null;
          unit_ar: string | null;
          unit_ar_plural: string | null;
          unit_grams: number | null;
          is_archived: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          name_ar?: string | null;
          slot?: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g?: number;
          typical_serving_g?: number | null;
          unit_en?: string | null;
          unit_en_plural?: string | null;
          unit_ar?: string | null;
          unit_ar_plural?: string | null;
          unit_grams?: number | null;
          is_archived?: boolean;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_foods"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_foods_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_ingredients: {
        Row: {
          id: string;
          name_en: string;
          name_ar: string;
          slot: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g: number;
          typical_serving_g: number | null;
          budget_tier: string;
          tags: string[];
          is_slot_default: boolean;
          image_url: string | null;
          created_at: string | null;
          unit_en: string | null;
          unit_en_plural: string | null;
          unit_ar: string | null;
          unit_ar_plural: string | null;
          unit_grams: number | null;
          breakfast_ok: boolean;
          // migration 049 — retired-but-referenced foods, and the mirror of
          // breakfast_ok for Meal 2 / Meal 3 / the last meal.
          in_catalog: boolean;
          main_meal_ok: boolean;
        };
        Insert: {
          id: string;
          name_en: string;
          name_ar: string;
          slot: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g?: number;
          typical_serving_g?: number | null;
          budget_tier?: string;
          tags?: string[];
          is_slot_default?: boolean;
          image_url?: string | null;
          created_at?: string | null;
          unit_en?: string | null;
          unit_en_plural?: string | null;
          unit_ar?: string | null;
          unit_ar_plural?: string | null;
          unit_grams?: number | null;
          breakfast_ok?: boolean;
          in_catalog?: boolean;
          main_meal_ok?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["nutrition_ingredients"]["Insert"]>;
        Relationships: [];
      };
      meal_templates: {
        Row: {
          id: string;
          title_en: string;
          title_ar: string;
          cooking_tier: string;
          budget_tier: string;
          notes_en: string | null;
          notes_ar: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          title_en: string;
          title_ar: string;
          cooking_tier?: string;
          budget_tier?: string;
          notes_en?: string | null;
          notes_ar?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meal_templates"]["Insert"]>;
        Relationships: [];
      };
      meal_template_slots: {
        Row: {
          id: string;
          template_id: string;
          meal_key: string;
          order_index: number;
          ingredient_id: string;
          role: string;
          is_optional: boolean;
        };
        Insert: {
          id?: string;
          template_id: string;
          meal_key: string;
          order_index: number;
          ingredient_id: string;
          role: string;
          is_optional?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["meal_template_slots"]["Insert"]>;
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          diet_profile_id: string;
          version: number;
          is_active: boolean | null;
          generated_at: string | null;
          user_modified: boolean | null;
          warnings_acknowledged: Json | null;
          template_code: string | null;
          // migration 043 — built by hand rather than from a template
          is_custom: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          diet_profile_id: string;
          version?: number;
          is_active?: boolean | null;
          generated_at?: string | null;
          user_modified?: boolean | null;
          warnings_acknowledged?: Json | null;
          template_code?: string | null;
          is_custom?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["meal_plans"]["Insert"]>;
        Relationships: [];
      };
      meal_plan_meals: {
        Row: {
          id: string;
          meal_plan_id: string;
          day_number: number;
          meal_type: string;
          order_index: number;
          slot_label: string | null;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          day_number?: number;
          meal_type: string;
          order_index: number;
          slot_label?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["meal_plan_meals"]["Insert"]
        >;
        Relationships: [];
      };
      meal_plan_items: {
        Row: {
          id: string;
          meal_id: string;
          ingredient_id: string | null;
          // migration 043 — exactly one of ingredient_id / user_food_id is set
          user_food_id: string | null;
          quantity_g: number;
          role: string | null;
          is_optional: boolean;
          is_user_modified: boolean | null;
        };
        Insert: {
          id?: string;
          meal_id: string;
          ingredient_id?: string | null;
          user_food_id?: string | null;
          quantity_g: number;
          role?: string | null;
          is_optional?: boolean;
          is_user_modified?: boolean | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["meal_plan_items"]["Insert"]
        >;
        Relationships: [];
      };
      training_profiles: {
        Row: {
          id: string;
          user_id: string;
          version: number;
          is_active: boolean | null;
          days_per_week: number;
          session_minutes: number | null;
          experience: string;
          injuries: string[] | null;
          goal: string;
          favorite_exercises: string[] | null;
          weak_muscles: string[] | null;
          consistency_self_rating: number | null;
          created_at: string | null;
          // migration 022 — one column per questionnaire_questions.id
          /** Retired by migration 026 — kept for historical rows, never written anymore. */
          session_duration: string | null;
          location: string | null;
          equipment_gym: string[] | null;
          equipment_home: string[] | null;
          training_style: string | null;
          pullup_ability: string | null;
          lift_comfort: string[] | null;
          age_bracket: string | null;
          gender: string | null;
          pregnancy_status: string | null;
          /** Retired by migration 026 — kept for historical rows, never written anymore. */
          body_focus: string[] | null;
          exercise_dislikes: string[] | null;
          weight_goal: string | null;
          cardio_preference: string | null;
          recovery_capacity: string | null;
          // migration 043 — 'guided' (questionnaire) or 'custom' (builder)
          build_mode: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          version?: number;
          is_active?: boolean | null;
          days_per_week: number;
          session_minutes?: number | null;
          experience: string;
          injuries?: string[] | null;
          goal: string;
          favorite_exercises?: string[] | null;
          weak_muscles?: string[] | null;
          consistency_self_rating?: number | null;
          created_at?: string | null;
          session_duration?: string | null;
          location?: string | null;
          equipment_gym?: string[] | null;
          equipment_home?: string[] | null;
          training_style?: string | null;
          pullup_ability?: string | null;
          lift_comfort?: string[] | null;
          age_bracket?: string | null;
          gender?: string | null;
          pregnancy_status?: string | null;
          body_focus?: string[] | null;
          exercise_dislikes?: string[] | null;
          weight_goal?: string | null;
          cardio_preference?: string | null;
          recovery_capacity?: string | null;
          build_mode?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["training_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name_en: string;
          name_ar: string | null;
          name_fr: string | null;
          /** NULL for exercise_type 'cardio' | 'stretching' (migration 019). */
          primary_muscle: string | null;
          secondary_muscles: string[] | null;
          equipment: string;
          movement_pattern: string | null;
          difficulty: string | null;
          contraindicated_for: string[] | null;
          substitution_group: string | null;
          video_url: string | null;
          thumbnail_url: string | null;
          instructions: string | null;
          created_at: string | null;
          slug: string | null;
          exercise_type: string;
          needs_tier_review: boolean;
          needs_home_review: boolean;
          ar_needs_review: boolean;
          needs_injury_review: boolean;
          // migration 024 — training-logic role tags
          role: string | null;
          sub_target: string | null;
          true_max_effort: boolean;
          needs_role_review: boolean;
          /** migration 051 — MET, for the cardio burned-calorie estimate. */
          met_value: number | null;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_ar?: string | null;
          name_fr?: string | null;
          primary_muscle?: string | null;
          secondary_muscles?: string[] | null;
          equipment: string;
          movement_pattern?: string | null;
          difficulty?: string | null;
          contraindicated_for?: string[] | null;
          substitution_group?: string | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          instructions?: string | null;
          created_at?: string | null;
          slug?: string | null;
          exercise_type?: string;
          needs_tier_review?: boolean;
          needs_home_review?: boolean;
          ar_needs_review?: boolean;
          needs_injury_review?: boolean;
          role?: string | null;
          sub_target?: string | null;
          true_max_effort?: boolean;
          needs_role_review?: boolean;
          met_value?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      // program_templates / template_days / template_exercises dropped in
      // migration 023 — the template-copy engine was replaced by slot filling,
      // which migration 027 then retired in turn (see below).
      user_programs: {
        Row: {
          id: string;
          user_id: string;
          training_profile_id: string;
          version: number;
          is_active: boolean | null;
          name: string;
          split_type: string;
          user_modified: boolean | null;
          warnings_acknowledged: Json | null;
          // migration 043 — assembled in the builder, not copied from a split
          is_custom: boolean;
          generated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          training_profile_id: string;
          version?: number;
          is_active?: boolean | null;
          name: string;
          split_type: string;
          user_modified?: boolean | null;
          warnings_acknowledged?: Json | null;
          is_custom?: boolean;
          generated_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_programs"]["Insert"]
        >;
        Relationships: [];
      };
      user_program_days: {
        Row: {
          id: string;
          user_program_id: string;
          day_number: number;
          day_name: string;
        };
        Insert: {
          id?: string;
          user_program_id: string;
          day_number: number;
          day_name: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_program_days"]["Insert"]
        >;
        Relationships: [];
      };
      user_program_exercises: {
        Row: {
          id: string;
          user_program_day_id: string;
          exercise_id: string;
          order_index: number;
          sets: number;
          rep_range: string;
          rest_seconds: number | null;
          is_user_modified: boolean | null;
          notes: string | null;
          notes_ar: string | null;
        };
        Insert: {
          id?: string;
          user_program_day_id: string;
          exercise_id: string;
          order_index: number;
          sets?: number;
          rep_range?: string;
          rest_seconds?: number | null;
          is_user_modified?: boolean | null;
          notes?: string | null;
          notes_ar?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_program_exercises"]["Insert"]
        >;
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          user_program_day_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          notes: string | null;
          skipped_exercise_ids: string[];
        };
        Insert: {
          id?: string;
          user_id: string;
          user_program_day_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          skipped_exercise_ids?: string[];
        };
        Update: Partial<
          Database["public"]["Tables"]["workout_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      workout_sets: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg: number | null;
          reps: number;
          rpe: number | null;
          rir: number | null;
          is_warmup: boolean | null;
          user_program_exercise_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg?: number | null;
          reps: number;
          rpe?: number | null;
          rir?: number | null;
          is_warmup?: boolean | null;
          user_program_exercise_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_sets"]["Insert"]>;
        Relationships: [];
      };
      // migration 051 — cardio. Deliberately NOT user_program_exercises /
      // workout_sets: cardio has no sets, no load and no progression, and must
      // not appear in anything that reads those.
      user_program_cardio: {
        Row: {
          id: string;
          user_program_day_id: string;
          exercise_id: string;
          minutes: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_program_day_id: string;
          exercise_id: string;
          minutes: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_program_cardio"]["Insert"]>;
        Relationships: [];
      };
      workout_cardio_logs: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          minutes: number;
          /** Shown to the user. Never read by anything under diet/. */
          calories_burned: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          minutes: number;
          calories_burned: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_cardio_logs"]["Insert"]>;
        Relationships: [];
      };
      daily_checkins: {
        Row: {
          id: string;
          user_id: string;
          checkin_date: string;
          weight_kg: number | null;
          energy: number | null;
          sleep_hours: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          checkin_date?: string;
          weight_kg?: number | null;
          energy?: number | null;
          sleep_hours?: number | null;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["daily_checkins"]["Insert"]
        >;
        Relationships: [];
      };
      meal_logs: {
        Row: {
          id: string;
          user_id: string;
          logged_at: string;
          log_date: string;
          meal_slot: string | null;
          ingredient_id: string | null;
          // migration 043 — set when the entry came from the user's own food
          user_food_id: string | null;
          custom_name: string | null;
          quantity_g: number | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          entry_method: string;
          source_confidence: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          logged_at?: string;
          log_date?: string;
          meal_slot?: string | null;
          ingredient_id?: string | null;
          user_food_id?: string | null;
          custom_name?: string | null;
          quantity_g?: number | null;
          calories: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          entry_method?: string;
          source_confidence?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["meal_logs"]["Insert"]>;
        Relationships: [];
      };
      plan_adaptations: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          reason_key: string;
          payload: Json;
          applied_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          reason_key: string;
          payload?: Json;
          applied_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["plan_adaptations"]["Insert"]
        >;
        Relationships: [];
      };
      food_favorites: {
        Row: {
          user_id: string;
          ingredient_id: string;
          created_at: string | null;
        };
        Insert: {
          user_id: string;
          ingredient_id: string;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["food_favorites"]["Insert"]
        >;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          payload: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          payload?: Json;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          tier: string;
          months: number;
          price_tnd: number;
          is_enabled: boolean;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          tier: string;
          months: number;
          price_tnd: number;
          is_enabled?: boolean;
          updated_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscription_plans"]["Insert"]
        >;
        Relationships: [];
      };
      qa_categories: {
        Row: {
          id: string;
          slug: string;
          name_fr: string | null;
          name_en: string | null;
          name_ar: string | null;
          order_index: number | null;
          icon: string | null;
          accent_color: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name_fr?: string | null;
          name_en?: string | null;
          name_ar?: string | null;
          order_index?: number | null;
          icon?: string | null;
          accent_color?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["qa_categories"]["Insert"]>;
        Relationships: [];
      };
      qa_cards: {
        Row: {
          id: string;
          category_id: string | null;
          question_fr: string | null;
          question_en: string | null;
          question_ar: string | null;
          answer_short: string | null;
          answer_long_md: string | null;
          answer_short_ar: string | null;
          answer_long_md_ar: string | null;
          // migration 031: visual answer-card blocks
          external_id: string | null;
          science_explanation: string | null;
          science_explanation_ar: string | null;
          practical_application: string | null;
          practical_application_ar: string | null;
          common_mistake: string | null;
          common_mistake_ar: string | null;
          coach_tip: string | null;
          coach_tip_ar: string | null;
          warning: string | null;
          warning_ar: string | null;
          difficulty_level: string | null;
          estimated_read_time: string | null;
          icon: string | null;
          accent_color: string | null;
          visual_type: string | null;
          visual_data: Json | null;
          scientific_sources: Json | null;
          order_index: number | null;
          is_published: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          question_fr?: string | null;
          question_en?: string | null;
          question_ar?: string | null;
          answer_short?: string | null;
          answer_long_md?: string | null;
          answer_short_ar?: string | null;
          answer_long_md_ar?: string | null;
          external_id?: string | null;
          science_explanation?: string | null;
          science_explanation_ar?: string | null;
          practical_application?: string | null;
          practical_application_ar?: string | null;
          common_mistake?: string | null;
          common_mistake_ar?: string | null;
          coach_tip?: string | null;
          coach_tip_ar?: string | null;
          warning?: string | null;
          warning_ar?: string | null;
          difficulty_level?: string | null;
          estimated_read_time?: string | null;
          icon?: string | null;
          accent_color?: string | null;
          visual_type?: string | null;
          visual_data?: Json | null;
          scientific_sources?: Json | null;
          order_index?: number | null;
          is_published?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["qa_cards"]["Insert"]>;
        Relationships: [];
      };
      qa_requests: {
        Row: {
          id: string;
          user_id: string;
          question_text: string;
          status: string;
          promoted_qa_card_id: string | null;
          answered_seen_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_text: string;
          status?: string;
          promoted_qa_card_id?: string | null;
          answered_seen_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["qa_requests"]["Insert"]>;
        Relationships: [];
      };

      // ---- migration 031: how many questions a user may ask per month ----
      qa_settings: {
        Row: {
          id: number;
          monthly_question_limit: number;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          monthly_question_limit?: number;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["qa_settings"]["Insert"]>;
        Relationships: [];
      };

      // ---- migration 034: report a problem → admin answers ----
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          status: string;
          last_message_at: string | null;
          last_admin_reply_at: string | null;
          user_seen_at: string | null;
          // migration 044 — set when the thread is about a payment request
          payment_request_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category?: string;
          status?: string;
          last_message_at?: string | null;
          last_admin_reply_at?: string | null;
          user_seen_at?: string | null;
          payment_request_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender: string;
          body: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender: string;
          body: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["support_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---- migration 019: canonical catalog config ----
      exercise_ratings: {
        Row: {
          exercise_id: string;
          tier: string;
          home_friendly: boolean;
        };
        Insert: {
          exercise_id: string;
          tier: string;
          home_friendly?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["exercise_ratings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "exercise_ratings_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: true;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaire_questions: {
        Row: {
          id: string;
          order_index: number;
          question_en: string;
          question_ar: string | null;
          type: string;
          options: Json;
          options_ar: Json | null;
          shown_if: Json | null;
          max_selections: number | null;
        };
        Insert: {
          id: string;
          order_index: number;
          question_en: string;
          question_ar?: string | null;
          type: string;
          options: Json;
          options_ar?: Json | null;
          shown_if?: Json | null;
          max_selections?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["questionnaire_questions"]["Insert"]>;
        Relationships: [];
      };
      questionnaire_rules: {
        Row: { key: string; payload: Json };
        Insert: { key: string; payload: Json };
        Update: Partial<Database["public"]["Tables"]["questionnaire_rules"]["Insert"]>;
        Relationships: [];
      };
      // split_definitions / split_days / split_day_slots were retired by
      // migration 027: the slot-filling picker they described is gone and
      // programs now copy a fixed_splits row verbatim. Their types are removed
      // so nothing can start reading them again by accident; the tables are
      // left in the database, holding the seed the old generator ran on.
      // Pre-built splits from the sheet (migration 027). One row per
      // (gender, days_per_week); replaces the split_definitions slot system.
      fixed_splits: {
        Row: {
          id: string;
          gender: string;
          days_per_week: number;
          title_en: string;
          week_order_en: string | null;
        };
        Insert: {
          id: string;
          gender: string;
          days_per_week: number;
          title_en: string;
          week_order_en?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fixed_splits"]["Insert"]>;
        Relationships: [];
      };
      fixed_split_days: {
        Row: {
          id: string;
          fixed_split_id: string;
          day_number: number;
          day_name_en: string;
          day_name_ar: string | null;
          description_en: string | null;
        };
        Insert: {
          id?: string;
          fixed_split_id: string;
          day_number: number;
          day_name_en: string;
          day_name_ar?: string | null;
          description_en?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fixed_split_days"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "fixed_split_days_fixed_split_id_fkey";
            columns: ["fixed_split_id"];
            isOneToOne: false;
            referencedRelation: "fixed_splits";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_split_exercises: {
        Row: {
          id: string;
          fixed_split_day_id: string;
          order_index: number;
          exercise_id: string;
          reps: string;
          swap_options: Json;
          advice_en: string | null;
          advice_ar: string | null;
        };
        Insert: {
          id?: string;
          fixed_split_day_id: string;
          order_index: number;
          exercise_id: string;
          reps: string;
          swap_options?: Json;
          advice_en?: string | null;
          advice_ar?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fixed_split_exercises"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "fixed_split_exercises_fixed_split_day_id_fkey";
            columns: ["fixed_split_day_id"];
            isOneToOne: false;
            referencedRelation: "fixed_split_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixed_split_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // migration 038: the dashboard's Q&A spark, sampled in the database so
      // the payload is five rows instead of the whole published library.
      qa_cards_random: {
        Args: { n?: number };
        Returns: {
          id: string;
          question_en: string | null;
          question_ar: string | null;
          answer_short: string | null;
          answer_short_ar: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience helpers used across the app.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
