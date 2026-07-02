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
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payment_requests: {
        Row: {
          id: string;
          user_id: string;
          method_key: string;
          amount_tnd: number;
          status: string;
          created_at: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          method_key: string;
          amount_tnd: number;
          status?: string;
          created_at?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          method_key?: string;
          amount_tnd?: number;
          status?: string;
          created_at?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
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
      foods: {
        Row: {
          id: string;
          name_ar: string;
          name_fr: string | null;
          name_en: string | null;
          category: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g: number | null;
          typical_serving_g: number | null;
          price_tnd_per_kg: number | null;
          price_tier: string | null;
          allergens: string[] | null;
          tags: string[] | null;
          is_common: boolean | null;
          image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name_ar: string;
          name_fr?: string | null;
          name_en?: string | null;
          category: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          fiber_per_100g?: number | null;
          typical_serving_g?: number | null;
          price_tnd_per_kg?: number | null;
          price_tier?: string | null;
          allergens?: string[] | null;
          tags?: string[] | null;
          is_common?: boolean | null;
          image_url?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["foods"]["Insert"]>;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          name_ar: string;
          name_fr: string | null;
          name_en: string | null;
          category: string | null;
          typical_serving_g: number | null;
          calories_per_100g: number | null;
          protein_per_100g: number | null;
          carbs_per_100g: number | null;
          fat_per_100g: number | null;
          fiber_per_100g: number | null;
          price_tier: string | null;
          allergens: string[] | null;
          tags: string[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name_ar: string;
          name_fr?: string | null;
          name_en?: string | null;
          category?: string | null;
          typical_serving_g?: number | null;
          calories_per_100g?: number | null;
          protein_per_100g?: number | null;
          carbs_per_100g?: number | null;
          fat_per_100g?: number | null;
          fiber_per_100g?: number | null;
          price_tier?: string | null;
          allergens?: string[] | null;
          tags?: string[] | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Insert"]>;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          food_id: string;
          quantity_g: number;
          order_index: number | null;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          food_id: string;
          quantity_g: number;
          order_index?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["recipe_ingredients"]["Insert"]
        >;
        Relationships: [];
      };
      user_foods: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_foods"]["Insert"]>;
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
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          day_number?: number;
          meal_type: string;
          order_index: number;
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
          food_id: string | null;
          recipe_id: string | null;
          user_food_id: string | null;
          quantity_g: number;
          is_user_modified: boolean | null;
        };
        Insert: {
          id?: string;
          meal_id: string;
          food_id?: string | null;
          recipe_id?: string | null;
          user_food_id?: string | null;
          quantity_g: number;
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
          equipment: string;
          experience: string;
          injuries: string[] | null;
          goal: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          version?: number;
          is_active?: boolean | null;
          days_per_week: number;
          session_minutes?: number | null;
          equipment: string;
          experience: string;
          injuries?: string[] | null;
          goal: string;
          created_at?: string | null;
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
          primary_muscle: string;
          secondary_muscles: string[] | null;
          equipment: string;
          movement_pattern: string | null;
          difficulty: string | null;
          contraindicated_for: string[] | null;
          video_url: string | null;
          thumbnail_url: string | null;
          instructions: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_ar?: string | null;
          name_fr?: string | null;
          primary_muscle: string;
          secondary_muscles?: string[] | null;
          equipment: string;
          movement_pattern?: string | null;
          difficulty?: string | null;
          contraindicated_for?: string[] | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          instructions?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      program_templates: {
        Row: {
          id: string;
          name: string;
          split_type: string;
          days_per_week: number;
          goal: string;
          experience: string;
          equipment_required: string;
          description: string | null;
          rationale_template: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          split_type: string;
          days_per_week: number;
          goal: string;
          experience: string;
          equipment_required: string;
          description?: string | null;
          rationale_template?: Json | null;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["program_templates"]["Insert"]
        >;
        Relationships: [];
      };
      template_days: {
        Row: {
          id: string;
          template_id: string;
          day_number: number;
          day_name: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          day_number: number;
          day_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_days"]["Insert"]>;
        Relationships: [];
      };
      template_exercises: {
        Row: {
          id: string;
          template_day_id: string;
          exercise_id: string;
          order_index: number;
          sets: number;
          rep_range: string;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          template_day_id: string;
          exercise_id: string;
          order_index: number;
          sets?: number;
          rep_range?: string;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["template_exercises"]["Insert"]
        >;
        Relationships: [];
      };
      user_programs: {
        Row: {
          id: string;
          user_id: string;
          training_profile_id: string;
          source_template_id: string | null;
          version: number;
          is_active: boolean | null;
          name: string;
          split_type: string;
          user_modified: boolean | null;
          warnings_acknowledged: Json | null;
          generated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          training_profile_id: string;
          source_template_id?: string | null;
          version?: number;
          is_active?: boolean | null;
          name: string;
          split_type: string;
          user_modified?: boolean | null;
          warnings_acknowledged?: Json | null;
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
        };
        Insert: {
          id?: string;
          user_id: string;
          user_program_day_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
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
          is_warmup: boolean | null;
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
          is_warmup?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workout_sets"]["Insert"]>;
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
        };
        Insert: {
          id?: string;
          slug: string;
          name_fr?: string | null;
          name_en?: string | null;
          name_ar?: string | null;
          order_index?: number | null;
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
          answer_short: string;
          answer_long_md: string | null;
          answer_short_ar: string | null;
          answer_long_md_ar: string | null;
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
          answer_short: string;
          answer_long_md?: string | null;
          answer_short_ar?: string | null;
          answer_long_md_ar?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
