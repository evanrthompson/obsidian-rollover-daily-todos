# Rollover Daily Todos

[![Build](https://github.com/lumoe/obsidian-rollover-daily-todos/actions/workflows/ci.yml/badge.svg)](https://github.com/lumoe/obsidian-rollover-daily-todos/actions/workflows/ci.yml)

This Obsidian plugin rolls over unfinished todos from the previous daily note (could be yesterday, or a week ago) to today by copying a delimited **section** of the previous day's note into the new one. Completed todos and their nested content are left behind; sub-headers and unfinished todos inside the section are preserved. This is triggered automatically when a new daily note is created via the internal `Daily notes` plugin or the `Periodic Notes` plugin, and can also be run as a command from the Command Palette.

![A demo of the plugin working](./demo.gif)

## Example daily-note template

```markdown
# {{date}}

## Rollover
### asap
### this week
### someday

## Notes
```

When a new daily note is created, the plugin finds the `## Rollover` heading on yesterday's note, copies everything inside it (sub-headers, todos, and loose text), and merges that content into today's `## Rollover` section. Completed todos and anything indented beneath them are left behind on yesterday's note.

### How the section is delimited

- The **Rollover section heading** setting names the heading that delimits the section (e.g. `## Rollover`).
- The section begins on the line after that heading.
- The section ends at the next heading of **equal or higher level** — so `## Notes` ends a `## Rollover` section; `### asap` does not. Sub-headers can nest freely inside.
- The first occurrence of the heading on each note is used.

### What rolls over

- Unfinished todos (and their indented children, when "Roll over children of todos" is on).
- Sub-headers inside the section — preserved so today's note keeps the same structure.
- Loose text and paragraphs inside the section.

### What does not roll over

- Completed todos (per the "Done status markers" setting).
- Anything indented beneath a completed todo.

### Merge behavior on today's note

- If today's note already has a matching sub-header (e.g. from the template), unfinished todos from yesterday are **appended** at the bottom of today's sub-header.
- If yesterday has a sub-header today doesn't, it's added at the end of today's rollover section.

## Usage

### 1. New Daily Note

Just create a new daily note using the `Daily notes` or `Periodic Notes` plugin. The previous day's incomplete todos will be rolled over to today's daily note.

**Note:** Automatic rollover can cause conflicts with other plugins, particularly the Templater plugin. If you're using Templater for your daily notes, it's recommended that you disable automatic rollover in the plugin's settings and instead trigger it manually after creation.

### 2. Command: Manual Rollover Todos Now

You can also open your command palette (CMD+P on macOS) and start typing `roll` to find this command. No matter where you are in Obsidian, the previous day's todos will get rolled forward. There is also a command called `Undo last rollover` which can be run within 2 minutes of a rollover occurring. Both commands are potentially destructive, and the default text element undo command (CMD+Z on macOS) didn't work. Currently only 1 undo is available for use at the moment.

Note that if you create a daily note in the future, and you try to run this command, todos will not be rolled into a future date. They will always be rolled to today's note (if it doesn't exist, nothing will happen), from the chronologically closest (in the past) daily note.

## Requirements

- [ ] You must have either:
  1. `Daily notes` plugin installed _or_
  2. `Periodic Notes` plugin installed AND the **Daily Notes** setting toggled on
- [ ] A Note folder set in one of these plugins. Inside it you must have:
  1. 2 or more notes
  2. All notes must be named in the format you use for daily notes (for example `2021-08-29` for `YYYY-MM-DD` )

## Settings

### Rollover section heading

Select the heading that delimits the rollover section. The dropdown lists all headings from your daily-note template, plus `None`. If set to `None`, rollover is disabled and the plugin will show a notice prompting you to configure it.

Example: `## Rollover`.

The section begins on the line after this heading and ends at the next heading of equal or higher level (or end of file).

### Delete todos from previous day

When this setting is on, the unfinished todos that got rolled over are removed from yesterday's rollover section. Sub-headers, completed todos, and non-todo text stay on yesterday's note. Enabling this is destructive — use the `Undo last rollover` command within 2 minutes if you need to revert.

When off (default), rolled todos are duplicated: they appear on both yesterday's and today's notes.

### Remove empty todos in rollover

When this setting is on, empty unfinished todos (e.g. `- [ ]` with no text after it) are dropped from the rollover. They stay on yesterday's note (they weren't rolled) unless you also have "Delete todos from previous day" on — even then, since they weren't rolled, they are not deleted from yesterday's note. They only stop showing up on today's note.

### Roll over children of todos

When this setting is on, indented lines beneath an unfinished todo (sub-todos, notes, etc.) roll over along with the parent. When off, only the todo line itself rolls.

### Automatic rollover on daily note open

When on (default), the plugin automatically rolls over on daily-note creation. When off, you trigger rollover manually via the `Rollover Todos Now` command.

### Done status markers

Characters that represent "done" in checkboxes. Default is `xX-`. Add any characters that should be considered completed. For example, adding `?+>` treats `[?]`, `[+]`, and `[>]` as done. Supports Unicode and emoji.

### Add extra blank line between heading and todos

Inserts a blank line between existing content and content appended during rollover (applies per sub-section body, and between today's preamble and yesterday's appended preamble).

## Breaking change in 1.3.0

Versions prior to 1.3.0 rolled over every unfinished todo in the previous day's note as a flat list. 1.3.0 replaces this with section-based rollover: the plugin only touches the content inside the configured section heading on both notes.

**To upgrade:**

1. Add a section heading (e.g. `## Rollover`) to your daily-note template.
2. Move the todos you want to roll into that section (optionally under sub-headers like `### asap`).
3. Set "Rollover section heading" in plugin settings to that heading.

If the heading is not set, or is not present on either note, the plugin shows a notice and does nothing.

## Bugs/Issues

1. Sometimes you will use this plugin, and your unfinished todos will stay in the same spot. These could be formatting issues.

- Regex is used to search for unfinished todos: `/\s*[-*+] \[[^xX-]\].*/g` (or with your custom done markers)
- At a minimum, they need to look like: `start of line | tabs`-` `[` `]`Your text goes here`
- If you use spaces instead of tabs at the start of the line, the behavior of the plugin can be inconsistent. Sometimes it'll roll items over, but not delete them from the previous day when you have that option toggled on.

2. Sometimes, if you trigger the `rollover` function too quickly, it will read the state of a file before the new data was saved to disk. For example, if you add a new incomplete todo to yesterday's daily note, and then quickly run the `Rollover Todos Now` command, it may grab the state of the file a second or two before you ran the command. If this happens, just run the `Undo last rollover` command. Wait a second or two, then try rolling over todos again.

For example (no template heading, empty todos toggled on):

```markdown
You type in:

- [x] Do the dishes
- [ ] Take out the trash

And then you run the Rollover Todos Now command. Today's daily note might look like:

- [ ] Take out the trash

And the previous day might look like

- [x] Do the dishes
```

3. There are sometimes conflicts with other plugins that deal with new notes -- particularly the Templater plugin. In these situations, your todos may be removed from your previous note, and then not be saved into your new daily note. The simplest remedy is to disable the automatic rollover, and instead trigger it manually.

## Installation

This plugin can be installed within the `Third-party Plugins` tab within Obsidian
