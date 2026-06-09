-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('MEMBER', 'ADMIN', 'SUPERADMIN');

-- CreateTable
CREATE TABLE "baileys_auth" (
    "sessionId" TEXT NOT NULL,
    "session" TEXT,

    CONSTRAINT "baileys_auth_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "users" (
    "jid" TEXT NOT NULL,
    "lid" TEXT,
    "pushName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FREE',
    "expiredAt" TIMESTAMP(3),
    "limit" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'id',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isBlock" BOOLEAN NOT NULL DEFAULT false,
    "isMute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("jid")
);

-- CreateTable
CREATE TABLE "groups" (
    "jid" TEXT NOT NULL,
    "welcome" TEXT DEFAULT '',
    "goodbye" TEXT DEFAULT '',
    "isAntiLink" BOOLEAN NOT NULL DEFAULT false,
    "isAntiBot" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isMute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("jid")
);

-- CreateTable
CREATE TABLE "group_metadata" (
    "id" TEXT NOT NULL,
    "addressingMode" TEXT,
    "subject" TEXT NOT NULL,
    "subjectOwner" TEXT,
    "subjectOwnerPn" TEXT,
    "subjectTime" INTEGER,
    "size" INTEGER NOT NULL DEFAULT 0,
    "creation" INTEGER,
    "owner" TEXT NOT NULL DEFAULT '',
    "ownerPn" TEXT,
    "ownerCountryCode" TEXT,
    "desc" TEXT,
    "descId" TEXT,
    "descOwner" TEXT,
    "descOwnerPn" TEXT,
    "descTime" INTEGER,
    "restrict" BOOLEAN NOT NULL DEFAULT false,
    "announce" BOOLEAN NOT NULL DEFAULT false,
    "isCommunity" BOOLEAN NOT NULL DEFAULT false,
    "isCommunityAnnounce" BOOLEAN NOT NULL DEFAULT false,
    "joinApprovalMode" BOOLEAN NOT NULL DEFAULT false,
    "memberAddMode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "group_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_participants" (
    "groupJid" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_jid_idx" ON "users"("jid");

-- CreateIndex
CREATE INDEX "group_participants_userJid_idx" ON "group_participants"("userJid");

-- CreateIndex
CREATE UNIQUE INDEX "group_participants_groupJid_userJid_key" ON "group_participants"("groupJid", "userJid");

-- AddForeignKey
ALTER TABLE "group_metadata" ADD CONSTRAINT "group_metadata_id_fkey" FOREIGN KEY ("id") REFERENCES "groups"("jid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_groupJid_fkey" FOREIGN KEY ("groupJid") REFERENCES "groups"("jid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_userJid_fkey" FOREIGN KEY ("userJid") REFERENCES "users"("jid") ON DELETE CASCADE ON UPDATE CASCADE;
