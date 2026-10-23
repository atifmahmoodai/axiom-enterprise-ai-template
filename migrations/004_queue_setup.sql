DO $$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO axiom_jobs',current_database()); END $$;
