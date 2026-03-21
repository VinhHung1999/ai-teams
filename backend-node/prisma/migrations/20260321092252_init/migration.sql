-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tmux_session_name" TEXT,
    "working_directory" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backlog_items" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "story_points" INTEGER,
    "acceptance_criteria" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backlog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_items" (
    "id" SERIAL NOT NULL,
    "sprint_id" INTEGER NOT NULL,
    "backlog_item_id" INTEGER NOT NULL,
    "assignee_role" TEXT,
    "board_status" TEXT NOT NULL DEFAULT 'todo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "backlog_items" ADD CONSTRAINT "backlog_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_items" ADD CONSTRAINT "sprint_items_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_items" ADD CONSTRAINT "sprint_items_backlog_item_id_fkey" FOREIGN KEY ("backlog_item_id") REFERENCES "backlog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
