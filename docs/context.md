# Rummy Score Keeper App - Developer Specification

## Coding Instruction
1. Dont make changes without confirm with me. 

## Overview
This document outlines the technical specifications and features for the Rummy Score Keeper app across Android and iOS platforms.

## Technical Requirements
- **Platforms**: Android & iOS
- **Real-time Updates**: Synchronized data updates across multiple users
- **Authentication**: Email + Password authentication

## Tech Stack:
Frontend: React Native with TypeScript, Expo, and Expo Router
Backend/Database: Supabase
UI Framework: React Native Paper
AI Processing: DeepSeek

## Core Features

### 1. Game Management

#### New Game Setup
- **Access**: Game Admin only
- **Features**:
  - Create new Rummy game
  - Access to Game Settings
  - Add up to 20 players (before or during game)
  - Drag-and-drop player order configuration
  - Allow for a player to be admin for that game
  - Generate shareable Game ID
  - Start game functionality
  - Each Game  has a default player "X" in the end and the default score for each round is the same as whatever is in the default for the game setting

#### Game Settings
Game Settings are defaulted from the User Settings but the default setting in Game Settings override the User Game Settings and can be changed by the Admin anytime until the game ends.
- New Game Setup
  - Game Type (Stake, Pool)

  Default Settings
  - Player Count defaults to number of Players before first round score is recorded
  - Expense On ?(yes or no) , yes is selected by default
  - If Expense is On then the default expense is ?(-10)

  Stake Game Defaults
  - Drop is ?(-10)
  - MD is ?(-30)
  - Max Count is ?(-80)
  - Prize for each player is the same number of tokens as the players corresponding total count of the game

  Pool Game Defaults
  - Pool Amount is ? (100)
  - Drop is ?(-25)
  - MD is ?(-50)
  - Max Count is ?(-80)
  - Default Tokens Prize for each player is ?(-100)

#### Game Play
- **Score Types**:
  - Drop (-10)
  - MD (-30)
  - Rummy (positive value to balance round to 0)
  - Count (any number)
- **Features**:
  - Color-coded player list with unique numbers
  - Round-robin dealer rotation
  - Real-time score updates
  - Round score validation (sum must be 0)
  - Mid-game player addition
  - End game option (Admin only)

#### Game End
- **Features**:
  - Final score display
  - Token prize calculation
  - Prize adjustment (Admin only)
  - Prize distribution

### 2. Player Management

#### Player Registration
- **Required Fields**:
  - Name (First & Last)
  - Phone number (optional)
  - Email (optional)
- **Auto-generation**:
  - Unique player number
  - Unique color assignment
  - Default name if none provided (e.g., "Rummy Rookie #1")

#### Player Administration
- Player listing
- Search/filter functionality
- Email/text invitations
- New player registration

### 3. Token Management
- Cumulative token tracking
- Token transfer system (Admin only)
- Game token consolidation
- Real-time balance updates

### 4. User Roles

#### Game Admin
- Full game control
- Player management
- Token administration
- Prize adjustment

#### Player
- Real-time game view
- Game participation
- Personal token tracking
- Game viewing with Game ID (non-players)

## Screen Specifications

### 1. User Dashboard
- **Header**: "Rummy Score Keeper"
- **Navigation Links**:
  - New Game Setup
  - Game List
  - Player Management
  - Prize Tracker

### 2. Game Score Display
- **Layout**: Spreadsheet format like this or better 
https://photos.app.goo.gl/hQ1pWgS4PYhna4kd7
- **Features**:
  - Player initials as columns
  - Row-wise tally
  - Dealer initials per row
  - Error highlighting (red) for non-zero tallies
  - Running total scores
  - Player addition functionality
  - Undo capability

### 3. Additional Screens
- Game Prize Page
- Player Management Interface
- New Player Registration
- Prize Tracking Dashboard

## Navigation
- Universal back button
- Home button (Dashboard redirect)
- Player detail view on initial tap

## Data Validation
- Round score sum verification
- Token transfer validation
- Player uniqueness checks
- Real-time update verification

## Notes
- Unique player identification system
- Color-coding for same-initial differentiation
- Real-time synchronization priority
- Comprehensive input validation

## User Settings
- New Game Setup Defaults
  - Game Type (Stake, Pool)
  - Player Count defaults to number of Players before first round score is recorded
  - Expense On ? 
  - If Expense is On then the default expense is ?(-10)

  Stake Game Defaults
  - Drop is ?(-10)
  - MD is ?(-30)
  - Max Count is ?(-80)
  - Prize for each player is the same number of tokens as the players corresponding total count of the game

  Pool Game Defaults
  - Drop is -25
  - MD is -50
  - Max Count is -80
  - Default Tokens Deposit for each player is ?(-100)

## Database Schema

### Tables

#### users
- `id`: uuid (PK)
- `created_at`: timestamp
- `email`: text (unique)
- `phone`: text
- `first_name`: text
- `last_name`: text
- `avatar_url`: text
- `default_settings`: jsonb

#### games
- `id`: uuid (PK)
- `created_at`: timestamp
- `admin_id`: uuid (FK -> users.id)
- `status`: enum ('active', 'completed')
- `game_type`: enum ('stake', 'pool')
- `settings`: jsonb
- `current_round`: integer

#### game_players
- `id`: uuid (PK)
- `game_id`: uuid (FK -> games.id)
- `user_id`: uuid (FK -> users.id)
- `player_order`: integer
- `color_code`: text
- `joined_at`: timestamp
- `is_admin`: boolean

#### rounds
- `id`: uuid (PK)
- `game_id`: uuid (FK -> games.id)
- `round_number`: integer
- `dealer_id`: uuid (FK -> users.id)
- `created_at`: timestamp

#### scores
- `id`: uuid (PK)
- `round_id`: uuid (FK -> rounds.id)
- `player_id`: uuid (FK -> users.id)
- `score_type`: enum ('drop', 'md', 'rummy', 'count')
- `value`: integer
- `created_at`: timestamp

#### tokens
- `id`: uuid (PK)
- `game_id`: uuid (FK -> games.id)
- `user_id`: uuid (FK -> users.id)
- `amount`: integer
- `type`: enum ('prize', 'deposit')
- `created_at`: timestamp

## Project Structure

```
rummy-scorekeeper/
├── app/                      # Expo Router app directory
│   ├── (auth)/              # Authentication routes
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/              # Main app tabs
│   │   ├── dashboard.tsx    # User dashboard
│   │   ├── games/          
│   │   │   ├── [id].tsx    # Individual game view
│   │   │   ├── new.tsx     # New game setup
│   │   │   └── index.tsx   # Games list
│   │   ├── players/
│   │   │   ├── [id].tsx    # Player profile
│   │   │   └── index.tsx   # Player management
│   │   └── settings.tsx    # User settings
│   └── _layout.tsx         # Root layout
├── assets/                  # Static assets
│   ├── images/
│   └── fonts/
├── components/             # Reusable components
│   ├── game/
│   │   ├── ScoreTable.tsx
│   │   ├── PlayerList.tsx
│   │   └── GameControls.tsx
│   ├── player/
│   │   ├── PlayerCard.tsx
│   │   └── PlayerForm.tsx
│   └── shared/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Modal.tsx
├── constants/              # App constants
│   ├── Colors.ts
│   ├── Layout.ts
│   └── Config.ts
├── hooks/                  # Custom hooks
│   ├── useAuth.ts
│   ├── useGame.ts
│   └── usePlayer.ts
├── services/              # API and external services
│   ├── supabase.ts
│   └── notifications.ts
├── store/                 # State management
│   ├── gameStore.ts
│   └── userStore.ts
├── types/                 # TypeScript types
│   ├── game.ts
│   ├── player.ts
│   └── supabase.ts
├── utils/                 # Utility functions
│   ├── scoring.ts
│   ├── validation.ts
│   └── formatting.ts
├── app.json              # Expo config
├── babel.config.js       # Babel config
├── package.json         
└── tsconfig.json        # TypeScript config
```

Now the project structure is properly included within the markdown document. The structure shows a clear organization of:
- App routes using Expo Router
- Reusable components
- Hooks and services
- Type definitions
- Utility functions
- Configuration files

This organization promotes maintainability and scalability of the codebase.

### Game History Screen
- **Access**: All users
- **Features**:
  - Admin: View all games
  - Player: View only games they participated in
  - Chronological order (newest first)
  - Game status and details
  - Visual indicators:
    - Active games: Purple border
    - Completed games: Gray border
  - Time display:
    - Day of week
    - Date
    - Time



### Account Creation

User can create an account in 2 ways:
1. **Email Registration**: Using email + password combination
2. **Phone Registration**: Using phone number + OTP verification + password creation

#### Email Registration Flow:
- User enters email and password
- Account created immediately
- User can login with email + password

#### Phone Registration Flow:
1. **Initial Registration**: User enters phone number → receives OTP → verifies OTP
2. **Password Creation**: After OTP verification, user must create a password
3. **Subsequent Logins**: User enters phone number + password (no OTP needed)
4. **Security**: OTP verification required only for initial registration to prevent SMS spam

#### Password Requirements:
- All phone number users must create a password after first OTP verification
- Password must be at least 6 characters
- Password is required for all subsequent logins (no OTP needed)

The profile of a user should also have their email address. Display this in their profile page. 