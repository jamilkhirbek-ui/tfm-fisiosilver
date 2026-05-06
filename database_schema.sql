-- Esquema relacional resumido de Fisiosilver
-- Para ejecutar cambios de forma segura usa supabase_migration_tfm.sql

create table public.users (
  id uuid primary key references auth.users(id),
  email text,
  nombre_usuario text,
  edad integer default 75,
  sexo text default 'male',
  nacionalidad text default 'Española',
  idioma text default 'Español',
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  talla_cm numeric default 170,
  avatar_id integer default 0,
  smoking_status text default 'Nunca',
  nutritional_score numeric default 0,
  diary_preferences jsonb default '["weight", "systolicBP", "diastolicBP", "pulse", "glucose"]'::jsonb,
  alerts_json jsonb default '[]'::jsonb,
  role text default 'patient',
  active boolean default true,
  points numeric default 0,
  level integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id)
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  peso_kg numeric,
  frec_cardiaca_lpm integer,
  tas_mmhg integer,
  tad_mmhg integer,
  sat_o2_pct numeric,
  glucosa_mgdl numeric,
  caidas_detectadas integer default 0,
  pantorrilla_cm numeric,
  abdomen_cm numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.vigs_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  ayuda_dinero boolean not null,
  ayuda_telefono boolean not null,
  ayuda_medicacion boolean not null,
  barthel_grado integer,
  perdida_peso_6m boolean not null,
  deterioro_cognitivo_grado integer,
  usa_antidepresivos boolean not null,
  usa_psicofarmacos boolean not null,
  vulnerabilidad_social boolean not null,
  presenta_delirium boolean not null,
  caidas_recuentes boolean not null,
  presenta_ulceras boolean not null,
  polifarmacia boolean not null,
  presenta_disfagia boolean not null,
  dolor_control_dificil boolean not null,
  disnea_basal boolean not null,
  enf_oncologica integer default 0,
  enf_respiratoria integer default 0,
  enf_cardiaca integer default 0,
  enf_neurodegenerativa integer default 0,
  enf_digestiva integer default 0,
  enf_renal_cronica integer default 0,
  puntos_totales numeric,
  indice_vig_resultado numeric,
  created_at timestamptz default now()
);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.vigs_assessments(id) on delete cascade,
  question_key text not null,
  answer_value numeric,
  created_at timestamptz default now()
);

create table public.clinical_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  file_name text,
  resumen_ia text,
  hemoglobina numeric,
  albumina numeric,
  vitamina_d_25_oh numeric,
  glucosa numeric,
  creatinina numeric,
  pcr numeric,
  sodio numeric,
  tsh numeric,
  vitamina_b12 numeric,
  created_at timestamptz default now()
);

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  foto_url text,
  comida_descripcion text,
  calorias_est numeric,
  proteinas_g numeric,
  carbohidratos_g numeric,
  grasas_g numeric,
  created_at timestamptz default now()
);

create table public.user_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action_type text not null,
  description text,
  created_at timestamptz default now()
);

create table public.user_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table public.daily_logs_audit (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid references public.daily_logs(id),
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table public.vigs_assessment_audit (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.vigs_assessments(id),
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table public.clinical_reports_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.clinical_reports(id),
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);

create table public.nutrition_logs_audit (
  id uuid primary key default gen_random_uuid(),
  nutrition_log_id uuid references public.nutrition_logs(id),
  modified_by uuid references public.users(id),
  field_name text,
  old_value text,
  new_value text,
  modified_at timestamptz default now()
);
