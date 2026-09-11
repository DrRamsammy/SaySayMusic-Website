/**
 * SaySayMusic AI Music Builder
 * Separate Cloudflare Worker for musicbuilder.saysaymusic.com
 * Required binding: Workers AI as AI
 */

const APP_API = "https://stream.saysaymusic.com";
const LOGO_URL = "https://audio.saysaymusic.com/Logo_New1.png";
const TEXT_MODEL = "@cf/openai/gpt-oss-120b";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function json(value, status) {
  return new Response(JSON.stringify(value), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

async function requireCreator(request) {
  const cookie = request.headers.get("Cookie") || "";
  if (!cookie) return null;
  const response = await fetch(APP_API + "/api/me", { headers: { Cookie: cookie } });
  if (!response.ok) return null;
  const data = await response.json();
  const user = data && data.user;
  const role = String((user && user.role) || "").toLowerCase();
  return user && (role === "admin" || role === "creator" || role === "artist") ? user : null;
}

function extractJson(text) {
  text = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI response could not be read.");
  return JSON.parse(text.slice(start, end + 1));
}

async function runText(env, prompt, maxTokens, temperature) {
  if (!env.AI) throw new Error("Workers AI binding AI is not configured.");
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await env.AI.run(TEXT_MODEL, {
        messages: [
          { role: "system", content: "You are the SaySayMusic college-level educational music editor. Follow the requested JSON format exactly." },
          { role: "user", content: prompt }
        ],
        max_tokens: maxTokens || 3000,
        temperature: typeof temperature === "number" ? temperature : 0.35
      });
      const text = result && (result.response || result.output_text ||
        (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || result.result);
      if (text) return text;
      throw new Error("The AI returned an empty response.");
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function makePlan(request, env) {
  const body = await request.json();
  const topic = String(body.topic || "").trim();
  if (!topic) return json({ error: "Enter a topic first." }, 400);
  const count = Math.max(1, Math.min(100, Number(body.count) || 18));
  const songsPerAlbum = Math.max(1, Math.min(20, Number(body.songsPerAlbum) || 10));
  const requiredAlbumCount = Math.ceil(count / songsPerAlbum);
  const organization = String(body.organization || "AI chooses logical categories");
  const custom = String(body.custom || "").trim();
  const selectionRules = String(body.selectionRules || "Select only canonical examples that directly belong to the requested topic. Exclude related items that do not meet the strict definition. Before returning the plan, verify every song topic individually for eligibility, accuracy, duplication, and education-level relevance. Replace any questionable item with a stronger recognized example.").trim();
  const projectInstructions = String(body.projectInstructions || "").trim();
  const genreDirection = String(body.genreDirection || "").trim();
  const prompt = [
    "Create a complete SaySayMusic educational album plan.",
    "MAIN TOPIC: " + topic,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "",
    "Create EXACTLY " + count + " song topics total across all albums.",
    "Create EXACTLY " + requiredAlbumCount + " album(s). This number is mandatory because album count equals total songs divided by the maximum songs per album, rounded up.",
    "Put no more than " + songsPerAlbum + " songs in each album. Fill earlier albums to the maximum before using the final album.",
    "ORGANIZATION: " + organization + ". Group related items into clearly named albums/subcategories appropriate to the subject.",
    "MANDATORY TOPIC-SELECTION QUALITY RULES:\n" + selectionRules,
    custom ? "CREATOR'S REQUIRED LIST OR INSTRUCTIONS:\n" + custom : "The creator supplied no fixed list; select the most important distinct items.",
    projectInstructions ? "CREATOR'S PROJECT AND LYRIC INSTRUCTIONS:\n" + projectInstructions : "No additional creator instructions were supplied.",
    "If the creator supplied item names, preserve them and organize them; do not replace them unless explicitly requested.",
    genreDirection ? "CREATOR'S ALBUM GENRE DIRECTION: " + genreDirection : "Assign each album one suitable sound-family label from SaySayMusic favorites: Electro-Rock, Zouk-Soul, Afrobeats, Soca, Reggae, Reggaeton, Club Techno, Salsa, Merengue, Bachata, Cumbia, Timba, Latin Pop, Rap, Hip-Hop, R&B, Irish, A Cappella, Gospel, Big Band, Cinematic, Samba, or another strong world genre.",
    "The album genre must be a concise reusable sound-family label, normally one to three words, not a long production prompt. Keep genre families varied between albums unless the creator requests one family.",
    "Use a logical teaching order. Song titles must be exact scientific subtopics, never creative song names.",
    "Song titles must be app-ready: normally 2 to 8 words and never more than 60 characters. Use the shortest recognized academic name that remains unambiguous. Put detailed mechanisms and explanations in the lyrics, not the title.",
    "Each album title must be a concise category name of no more than six words. Never repeat the main project title and never include the words Album 1, Album 2, or another album number in the album title.",
    "Never return an unexplained gene symbol, abbreviation, catalog code, formula symbol, or acronym as a complete song title. Give the full recognized name and place the symbol or abbreviation in parentheses when useful.",
    "When the request says top, most important, or essential, build a representative curriculum with appropriate breadth. Do not fill a disproportionate share of the list with near-duplicates from one family when other major families are needed.",
    "Maintain rigorous subject accuracy at the selected education level. Choose the concepts, skills, examples, applications and teaching order appropriate to this subject.",
    "Do not omit essential material and do not duplicate topics.",
    "Before returning, audit every proposed item and album category. Record any questionable membership, mixed category, duplicate, unclear code, or weak example in audit.problems, and state the required correction.",
    'Return ONLY JSON: {"audit":{"problems":["Exact issue and correction"],"categoryRules":["Rule every final album must satisfy"]},"albums":[{"title":"Concise Category Title","genre":"Concise Album Genre","songs":[{"title":"Scientific Subtopic"}]}]}'
  ].join("\n");
  const draft = extractJson(await runText(env, prompt, 4000));
  if (!Array.isArray(draft.albums) || !draft.albums.length) throw new Error("No album plan was returned.");
  const critique = draft.audit || { problems: ["Recheck every item and category independently before finalizing."], categoryRules: ["Every item must fit its album title exactly."] };
  const correctionPrompt = [
    "Act as the final senior curriculum editor. Rebuild the draft using every finding from the independent critique.",
    "MAIN TOPIC: " + topic,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "REQUIRED TOTAL: exactly " + count + " distinct songs in exactly " + requiredAlbumCount + " album(s); maximum " + songsPerAlbum + " per album.",
    "ORGANIZATION: " + organization,
    "TOPIC RULES: " + selectionRules,
    custom ? "CREATOR REQUIREMENTS: " + custom : "No creator-supplied fixed list.",
    genreDirection ? "GENRE DIRECTION: " + genreDirection : "Use varied SaySayMusic genre families.",
    "DRAFT ALBUMS: " + JSON.stringify(draft.albums),
    "INDEPENDENT CRITIQUE: " + JSON.stringify(critique),
    "Correct every criticism. Each album must have a scientifically or academically precise category title, and every item in that album must fit that exact category. When categories cannot remain pure with the required album sizes, use an accurate broader title rather than a false narrow title.",
    "Album count is not discretionary. Return exactly " + requiredAlbumCount + " album(s). Use concise category-only album titles of no more than six words; do not repeat the project name or include album numbers.",
    "Use full recognized topic names. Add official codes or symbols in parentheses only when helpful. Never use an unexplained code alone.",
    "Shorten every song title to no more than 60 characters and normally 2 to 8 words. Remove parenthetical explanations and procedural detail that belongs in lyrics, while keeping the academic topic unambiguous.",
    "For a top or essential list, verify representative breadth across the major families of the requested topic. Replace excessive members of one narrow family with stronger canonical examples from missing major families.",
    "Write only a subject-specific teaching addendum describing facts, processes, calculations, chronology or other content the LYRICS must teach. Do not state numbers of albums, songs or total verses in the addendum.",
    "The builder returns only genre direction and lyrics. Never request diagrams, visual aids, tables, worksheets, assessments, quizzes, multiple-choice questions, answer keys, citations, or any deliverable outside the song lyrics.",
    "For mathematics, explicitly assign this structure: Verse 1 explains the formula and every variable; Verse 2 introduces one realistic numerical problem and identifies known and unknown values; Verses 3 and 4 solve it step by step with correct units; the ending gives a real-world use and explains why the formula matters.",
    projectInstructions ? "Also honor these creator instructions: " + projectInstructions : "There are no extra creator instructions.",
    "Return ONLY the corrected JSON.",
    'FORMAT: {"verified":true,"verificationSummary":"Corrected after an independent topic and category audit","projectInstructionsAddendum":"Subject-specific teaching requirements","albums":[{"title":"Accurate album category","genre":"Concise genre","songs":[{"title":"Full recognized topic name"}]}]}'
  ].join("\n");
  const data = extractJson(await runText(env, correctionPrompt, 4000));
  const standardInstructions = [
    "Create one educational song for each approved topic.",
    "Preserve the approved album order and song titles exactly. Never add, skip, rename, replace, reorder, regenerate, or duplicate a topic.",
    "Teach only the topic assigned to the current song and do not take over material assigned to another song.",
    "Verse 1 introduces and clearly defines the topic and essential terminology.",
    "Verse 2 explains the central concept, context, structure, rule, or problem.",
    "Verse 3 teaches the mechanism, reasoning, sequence, evidence, or calculation step by step.",
    "Verse 4 completes the explanation and connects it to related knowledge without losing focus.",
    "End with a correct real-world, clinical, historical, cultural, or practical application and explain why the topic matters.",
    "Never sacrifice accuracy for rhyme. Use the selected education level and check names, facts, units, equations, chronology, and conclusions before returning the song.",
    "Place clear phonetic respellings inside the lyrics for difficult terms when needed. Never place phonetics in the song title.",
    "Keep every song musically distinct while honoring its album sound family. Vary BPM, beat, instruments, vocals, chorus, and arrangement. Use English vocals."
  ].join("\n\n");
  const topicLower = topic.toLowerCase();
  let subjectFramework;
  if (/math|algebra|geometry|trigonom|calculus|statistic|probability|formula|equation/.test(topicLower)) {
    subjectFramework = [
      "Verse 1: State and explain the exact formula or mathematical concept. Define every symbol and variable in clear language.",
      "Verse 2: Introduce one realistic numerical problem that requires this formula. Clearly identify all known values and the unknown value.",
      "Verse 3: Select the formula, substitute the given values, and show every calculation step accurately and in the correct order.",
      "Verse 4: Complete the solution, state the correct answer with units, and check or interpret the result.",
      "The final section gives a real-world situation where the formula is used and explains why it matters. The chorus reinforces the formula without replacing the teaching steps. Use manageable numbers and never skip calculation steps."
    ].join("\n\n");
  } else if (/protein|biology|chemistry|molecule|cell|anatom|physiology|medical|disease|drug|lipid|enzyme|gene|science/.test(topicLower)) {
    subjectFramework = [
      "Verse 1: Identify and define the assigned scientific topic, including its location, structure, components, or classification when relevant.",
      "Verse 2: Explain its primary function, inputs and outputs, or biological and chemical role.",
      "Verse 3: Teach the mechanism or process step by step, including energy, direction, partners, reactions, or regulation when relevant.",
      "Verse 4: Explain physiological importance and relationships with relevant pathways without taking over another song's topic.",
      "The final section explains an accurate clinical, genetic, diagnostic, therapeutic, environmental, or everyday application when appropriate. Include phonetic guidance inside lyrics for difficult scientific terms."
    ].join("\n\n");
  } else if (/history|government|civics|geography|war|civilization|social studies/.test(topicLower)) {
    subjectFramework = [
      "Verse 1: Establish the people, place, period, and essential vocabulary.",
      "Verse 2: Explain the principal causes and historical context.",
      "Verse 3: Present the events or developments in accurate chronological order using established evidence.",
      "Verse 4: Explain immediate and long-term consequences, significance, and relevant perspectives.",
      "The final section connects the topic carefully to modern life without inventing quotations, dates, sources, or claims."
    ].join("\n\n");
  } else if (/language|english|spanish|french|grammar|vocabulary|literature|reading|writing/.test(topicLower)) {
    subjectFramework = [
      "Verse 1: Define the word, rule, text, or language concept clearly.",
      "Verse 2: Demonstrate correct meaning, pronunciation, structure, or usage with an accessible example.",
      "Verse 3: Contrast correct and common incorrect usage or analyze the assigned text feature.",
      "Verse 4: Provide additional contextual examples and a reliable memory connection.",
      "The final section applies the skill to real communication, reading, or writing. Never invent textual quotations."
    ].join("\n\n");
  } else {
    subjectFramework = [
      "Verse 1: Define the assigned topic and its essential vocabulary.",
      "Verse 2: Explain the central idea with a concrete example.",
      "Verse 3: Teach the appropriate process, reasoning, sequence, comparison, or evidence step by step.",
      "Verse 4: Complete the explanation, address a common misunderstanding, and reinforce the key learning objective.",
      "The final section gives an accurate practical application and explains why the topic matters."
    ].join("\n\n");
  }
  const aiAddendum = String(data.projectInstructionsAddendum || "").trim();
  const usefulAddendum = aiAddendum && !/^subject-specific teaching requirements[.!]?$/i.test(aiAddendum) ? "\n\nADDITIONAL AI-SUGGESTED REQUIREMENTS:\n" + aiAddendum : "";
  data.projectInstructions = standardInstructions + "\n\nSUBJECT-SPECIFIC REQUIREMENTS:\n" + subjectFramework + usefulAddendum + (projectInstructions ? "\n\nCREATOR'S SPECIAL REQUIREMENTS:\n" + projectInstructions : "");
  if (data.verified !== true) throw new Error("The independent quality review did not verify this plan. Please create it again.");
  if (!data.projectInstructions || String(data.projectInstructions).trim().length < 100) throw new Error("The AI did not create complete song-writing instructions. Please create the plan again.");
  if (!Array.isArray(data.albums) || !data.albums.length) throw new Error("The reviewed album plan was incomplete.");
  if (data.albums.length !== requiredAlbumCount) throw new Error("The AI returned " + data.albums.length + " albums instead of the required " + requiredAlbumCount + ". Please press Create again.");
  const returnedCount = data.albums.reduce((sum, album) => sum + (Array.isArray(album.songs) ? album.songs.length : 0), 0);
  if (returnedCount !== count) throw new Error("The AI returned " + returnedCount + " topics instead of " + count + ". Please press Create again.");
  if (data.albums.some(album => !Array.isArray(album.songs) || album.songs.length > songsPerAlbum)) throw new Error("The AI exceeded your songs-per-album limit. Please press Create again.");
  if (data.albums.some(album => album.songs.some(song => String(song.title || "").length > 60))) throw new Error("The AI returned a song title that is too long for the app. Please create the plan again.");
  return json(data);
}

async function makeSong(request, env) {
  const body = await request.json();
  const prompt = [
    "Write one SaySayMusic educational song package.",
    "MAIN TOPIC: " + body.topic,
    "ALBUM: " + body.albumTitle,
    "ALBUM SOUND FAMILY: " + String(body.albumGenre || "World Fusion"),
    "EXACT SONG TITLE: " + body.songTitle,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "OTHER SONGS IN THIS ALBUM: " + (body.albumSongs || []).join("; "),
    "CREATOR'S PROJECT AND LYRIC INSTRUCTIONS: " + String(body.projectInstructions || "Use the best educational song structure for this subject."),
    "",
    "Never rename, add, skip or replace the approved topic.",
    "Maintain rigorous accuracy for the selected subject and education level. Never sacrifice accuracy, calculation steps, chronology, terminology or meaning for rhyme.",
    "Follow the creator's project and lyric instructions exactly. Adapt the teaching structure to mathematics, science, history, language, literature or any other subject as required.",
    "For science, teach structure, function, mechanisms, regulation and clinical importance when relevant. For mathematics, define variables and show every requested solution step with correct arithmetic. For other subjects, use the appropriate evidence, sequence, vocabulary and applications.",
    "Do not take over material assigned to other songs.",
    "Put clear phonetic respellings inside the lyrics for difficult scientific terms. Never put phonetics in the title.",
    "The detailed musical direction must clearly remain inside the ALBUM SOUND FAMILY, while giving this song a distinct beat, BPM, key, instruments, vocal treatment, musical storytelling moments, mix and mastering direction. English vocals. Avoid making songs in the same album sound alike.",
    "Use [Intro], [Chorus], [Verse 1], [Chorus], [Verse 2], [Chorus], more verses when scientifically necessary, [Final Chorus], [SaySayMusic Tag].",
    "The final tag includes SaySayMusic and Education Through Melody.",
    'Return ONLY JSON: {"genre":"Complete musical direction","lyrics":"Complete lyrics with section labels"}'
  ].join("\n");
  const draft = extractJson(await runText(env, prompt, 4000));
  if (!draft.genre || !draft.lyrics) throw new Error("The AI did not return a complete song.");
  const reviewPrompt = [
    "Act as SaySayMusic's senior subject-matter editor and professional songwriter.",
    "Audit and CORRECT this educational song before the creator sees it.",
    "MAIN TOPIC: " + body.topic,
    "ALBUM: " + body.albumTitle,
    "ALBUM SOUND FAMILY: " + String(body.albumGenre || "World Fusion"),
    "EXACT SONG TITLE: " + body.songTitle,
    "LEVEL: " + String(body.level || "College / Medical School"),
    "OTHER SONGS IN THIS ALBUM: " + (body.albumSongs || []).join("; "),
    "PROJECT INSTRUCTIONS: " + String(body.projectInstructions || "Use the best educational song structure for this subject."),
    "DRAFT GENRE: " + draft.genre,
    "DRAFT LYRICS:\n" + draft.lyrics,
    "",
    "Correct every factual, mathematical, scientific, historical, linguistic, medical and clinical claim. Remove or cautiously rewrite anything uncertain, misleading, overstated, outdated or not directly relevant to the assigned topic.",
    "Check mechanisms, directions, units, numbers, gene and protein names, drug actions, diseases, chronology and terminology. Never invent a source or imply a drug has one specific molecular target when its accepted mechanism is broader.",
    "Check every difficult pronunciation. Use a clear phonetic respelling in parentheses inside lyrics only when needed. Greek delta must be pronounced DEL-tuh, never pol-dee. Never alter the approved song title.",
    "Make the lyrics genuinely singable in the assigned genre. Replace textbook paragraphs with short performance-ready lines, normally 4 to 14 words per line. Use natural rhythm, rhyme, repetition, breathing space and memorable teaching hooks without sacrificing accuracy.",
    "Keep the genre direction detailed but production-ready. Use a streaming-friendly mastering target near -14 LUFS with controlled low end and clear educational vocals, unless the creator explicitly requests another target.",
    "Do not use emoji, numbered-list symbols, markdown bullets, citations, footnotes, stage explanations or prose commentary inside the lyrics.",
    "Ensure the lyrics follow every required verse purpose and include all requested sections. Do not claim an exact bar count in the genre unless the lyrics can realistically support it.",
    "The [Final Chorus] must remain a memorable chorus that restates the central teaching hook. Put new clinical or real-world information in a separate [Final Section] before it, never inside the final chorus.",
    "Use the exact final labels [Final Section], [Final Chorus], and [SaySayMusic Tag]. The tag must say SaySayMusic and Education Through Melody.",
    "For human DNA replication, do not claim that ORC recognizes a universal consensus DNA sequence. Distinguish licensing from later origin activation and firing.",
    "Keep this song focused on its exact approved topic and do not take over another song's assigned material.",
    "Return only the corrected song package.",
    'FORMAT: {"genre":"Corrected complete musical direction","lyrics":"Corrected performance-ready lyrics with section labels"}'
  ].join("\n");
  const data = extractJson(await runText(env, reviewPrompt, 4500, 0.1));
  if (!data.genre || !data.lyrics) throw new Error("The song quality review did not return a complete correction.");
  if (/[①-⓿✀-➿🌀-🫿]/u.test(data.lyrics)) throw new Error("The song review found unsupported symbols. Please create the song again.");
  if (!/\[Final Chorus\]/i.test(data.lyrics) || !/\[SaySayMusic Tag\]/i.test(data.lyrics)) throw new Error("The song review did not preserve the required final chorus and SaySayMusic tag. Please create the song again.");
  return json(data);
}

async function createMusic(request, env) {
  if (!env.MUSICGPT_API_KEY) throw new Error("MusicGPT API key is not configured.");
  const body = await request.json();
  const title = String(body.title || "").trim().slice(0, 120);
  const genre = String(body.genre || "").trim().slice(0, 3000);
  const lyrics = String(body.lyrics || "").trim().slice(0, 12000);
  if (!title || !genre || !lyrics) return json({ error: "Song name, genre, and lyrics are required." }, 400);
  const response = await fetch("https://api.musicgpt.com/api/public/v2/MusicAI", {
    method: "POST",
    headers: { Authorization: env.MUSICGPT_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Create a polished educational song with clear English vocals. Follow the supplied lyrics exactly and prioritize intelligible pronunciation.",
      music_style: genre,
      lyrics,
      title,
      make_instrumental: false,
      vocal_only: false,
      generate_album_cover: false,
      lyrics_timestamps: false,
      model: "v6"
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: "MusicGPT could not start this song. " + String(data.message || "Please try again.") }, response.status || 502);
  if (!data.success || !data.task_id) return json({ error: String(data.message || "MusicGPT did not return a task ID.") }, 502);
  return json({ taskId: data.task_id, eta: data.eta || null, creditEstimate: data.credit_estimate || null, status: "QUEUED" });
}

async function musicStatus(request, env) {
  if (!env.MUSICGPT_API_KEY) throw new Error("MusicGPT API key is not configured.");
  const taskId = String(new URL(request.url).searchParams.get("task_id") || "").trim();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(taskId)) return json({ error: "A valid MusicGPT task ID is required." }, 400);
  const endpoint = new URL("https://api.musicgpt.com/api/public/v1/byId");
  endpoint.searchParams.set("conversionType", "MUSIC_AI");
  endpoint.searchParams.set("task_id", taskId);
  const response = await fetch(endpoint, { headers: { Authorization: env.MUSICGPT_API_KEY } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) return json({ error: String(data.message || "MusicGPT status could not be retrieved.") }, response.status || 502);
  const c = data.conversion || {};
  return json({
    taskId: c.task_id,
    status: String(c.status || "PROCESSING").toUpperCase(),
    message: c.message || "",
    tracks: [
      c.conversion_path_1 ? { version: 1, mp3: c.conversion_path_1, wav: c.conversion_path_wav_1 || "", duration: c.conversion_duration_1 || null } : null,
      c.conversion_path_2 ? { version: 2, mp3: c.conversion_path_2, wav: c.conversion_path_wav_2 || "", duration: c.conversion_duration_2 || null } : null
    ].filter(Boolean)
  });
}

async function makeCover(request, env) {
  const body = await request.json();
  if (!env.AI) throw new Error("Workers AI binding AI is not configured.");
  const conceptRequest = [
    "Design one world-class visual concept for a premium educational music album cover.",
    "Subject: " + body.topic + ". Album theme: " + body.albumTitle + ".",
    "Album songs: " + (Array.isArray(body.albumSongs) ? body.albumSongs.join("; ") : "not supplied") + ".",
    "Music family: " + String(body.albumGenre || "World Fusion") + ".",
    "Make the visual storytelling specific to the academic content, emotionally compelling, sophisticated, cinematic, richly layered and suitable for a professional global music release. Avoid generic stock imagery.",
    "Describe artwork only, with no typography or lettering.",
    'Return ONLY JSON: {"artPrompt":"One detailed image-generation prompt"}'
  ].join("\n");
  let artPrompt = "Cinematic premium educational artwork with sophisticated subject-specific visual storytelling.";
  try {
    const concept = extractJson(await runText(env, conceptRequest, 1200));
    if (concept.artPrompt) artPrompt = String(concept.artPrompt).slice(0, 800);
  } catch (conceptError) {}
  const prompt = [
    artPrompt,
    "Square 1:1 album-cover artwork. Subject: " + body.topic + ". Album theme: " + body.albumTitle + ".",
    "Use a strong central composition, depth, dramatic lighting, premium navy and gold with subject-appropriate accent colors, and subtle musical rhythm through motion and pattern.",
    "For mathematics use accurate geometric forms, graphs, numbers or measurement imagery and no molecules. For science use accurate imagery specific to the named scientific content. Adapt appropriately for every other subject.",
    "Keep the upper 24 percent and lower 28 percent visually calm for branding overlays.",
    "ARTWORK ONLY. Absolutely no letters, words, titles, captions, logos, labels, watermarks, banners, badges, stickers, or typographic shapes anywhere."
  ].join(" ").slice(0, 2048);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await env.AI.run(IMAGE_MODEL, { prompt: prompt, steps: 4 });
      if (result instanceof Response) {
        if (!result.ok) throw new Error("Image model returned " + result.status + ".");
        return new Response(result.body, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
      }
      if (result instanceof ReadableStream) {
        return new Response(result, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
      }
      if (result && result.image) {
        const binary = atob(result.image);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
      }
      if (result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
        return new Response(result, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
      }
      throw new Error("The image model returned an unreadable image.");
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SaySayMusic AI Music Builder</title>
<style>
:root{--navy:#092b5c;--blue:#0b63ce;--gold:#f1b82d;--green:#198754;--ink:#12213a;--line:#d7e0eb;--pale:#f3f6fb}
*{box-sizing:border-box}body{margin:0;background:var(--pale);color:var(--ink);font:17px/1.5 Arial,sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}button:focus,input:focus,select:focus,textarea:focus{outline:3px solid var(--gold);outline-offset:2px}
header{background:#fff;border-bottom:1px solid var(--line);padding:14px 20px}.head{max-width:1300px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{display:flex;align-items:center;gap:12px}.logo{display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:var(--navy);color:#fff;font-size:25px}.brand b{font-size:21px}.brand small{display:block;color:#627086}
.wrap{max-width:1300px;margin:auto;padding:18px}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.tab{min-height:62px;border:1px solid var(--line);border-radius:12px;background:#fff;font-weight:800}.tab.active{background:var(--blue);color:#fff}.tab:disabled{opacity:.4}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 3px 12px #17345b10}.center{max-width:760px;margin:auto}h1,h2,h3{line-height:1.2}h2{font-size:30px;margin:0 0 20px}label{display:block;font-weight:800;margin:16px 0 6px}.input,select,textarea{width:100%;border:1px solid #aebdd0;border-radius:11px;background:#fff;padding:13px;color:var(--ink)}.input,select{min-height:54px}textarea{min-height:120px}.lyrics{min-height:520px;line-height:1.65}
.btn{min-height:50px;border:0;border-radius:10px;padding:10px 18px;background:var(--blue);color:#fff;font-weight:800}.btn.secondary{background:#fff;color:var(--ink);border:1px solid #aebdd0}.btn.green{background:var(--green)}.wide{width:100%;margin-top:20px}.notice{margin-bottom:15px;padding:13px;border:1px solid #e0bc52;border-radius:10px;background:#fff8d9;font-weight:700}.progress{margin-bottom:15px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff}.bar{height:10px;border-radius:9px;background:#e4eaf1;overflow:hidden}.fill{height:100%;background:var(--green)}
.plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.album{border:1px solid var(--line);border-radius:15px;background:#f8fafc;padding:15px}.album h3{margin:0 0 10px}.album ol{margin:0;padding-left:27px}.album li{margin:7px 0}.editable{width:calc(100% - 4px);border:1px solid #c6d1df;border-radius:7px;padding:7px;background:#fff}
.help{color:#52647a;margin:5px 0 12px}.options{display:grid;grid-template-columns:1fr 1fr;gap:14px}.custom{min-height:150px}.editrow{display:grid;grid-template-columns:1fr auto;gap:7px;margin:7px 0}.smallbtn{border:1px solid #b8c5d5;background:#fff;border-radius:8px;padding:5px 10px;font-weight:700}.danger{color:#a51d2d}.planActions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.planActions .btn{flex:1}
.work{display:grid;grid-template-columns:320px 1fr;gap:16px}.side,.main{background:#fff;border:1px solid var(--line);border-radius:17px;padding:16px}.side button{width:100%;text-align:left;border:0;border-radius:9px;padding:10px;margin:2px 0;background:#eef2f7}.side button.active{background:var(--navy);color:#fff}.side .albumBtn{font-weight:800;background:#dfe9f6;margin-top:9px}.fieldHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.copybox{padding:13px;border:1px solid var(--line);border-radius:10px;background:#f8fafc;font-weight:800}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.cover{display:block;width:min(100%,600px);aspect-ratio:1;object-fit:cover;margin:20px auto;border-radius:18px;box-shadow:0 12px 30px #091f3e35}.empty{min-height:380px;display:grid;place-items:center;border:2px dashed #b9c7d9;border-radius:16px;background:#f8fafc}
.musicbox{margin-top:22px;padding:18px;border:2px solid #b9d5f7;border-radius:16px;background:#f3f8ff}.musicbox h3{margin-top:0}.versions{display:grid;grid-template-columns:1fr 1fr;gap:14px}.version{padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff}.version audio{display:block;width:100%;margin:10px 0}.version a{text-align:center;text-decoration:none;display:grid;place-items:center}
@media(max-width:850px){.plan,.work,.options,.versions{grid-template-columns:1fr}.side{max-height:320px;overflow:auto}.brand b{font-size:17px}.tabs .tab{font-size:15px}.wrap{padding:12px}.card{padding:18px}}
</style></head><body>
<header><div class="head"><div class="brand"><span class="logo">♫</span><div><b>SaySayMusic AI Music Builder</b><small>Education Through Melody</small></div></div><button id="newBtn" class="btn secondary" hidden>New Topic</button></div></header>
<div class="wrap">
 <nav class="tabs"><button class="tab active" data-tab="topics">1. Topics</button><button class="tab" data-tab="songs" disabled>2. Songs</button><button class="tab" data-tab="cover" disabled>3. Album Cover</button></nav>
 <div id="progress"></div><div id="notice"></div><div id="view"></div>
</div>
<script>
(function(){
 var API="/api",KEY="saysaymusic-builder-v1",plan=null,tab="topics",ai=0,si=0,busy=false,level="College / Medical School";
 function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]})}
 function save(){if(plan)localStorage.setItem(KEY,JSON.stringify(plan))}
 function note(s){document.getElementById("notice").innerHTML=s?'<div class="notice">'+esc(s)+'</div>':""}
 function totals(){var total=0,done=0;if(plan)plan.albums.forEach(function(a){total+=a.songs.length;a.songs.forEach(function(s){if(s.completed)done++})});return{total:total,done:done}}
 function chrome(){var t=totals(),p=t.total?Math.round(t.done/t.total*100):0;document.getElementById("progress").innerHTML=plan?'<div class="progress"><b>'+esc(plan.topic)+'</b><span style="float:right"><b>'+t.done+" of "+t.total+'</b> complete</span><div class="bar"><div class="fill" style="width:'+p+'%"></div></div></div>':"";document.getElementById("newBtn").hidden=!plan;document.querySelectorAll(".tab").forEach(function(b){b.classList.toggle("active",b.dataset.tab===tab);b.disabled=b.dataset.tab!=="topics"&&!(plan&&plan.approved)})}
 async function call(path,body){var r=await fetch(API+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),raw=await r.text(),d;try{d=JSON.parse(raw)}catch(e){throw Error("Cloudflare error "+r.status+". Check the Worker live log.")}if(!r.ok)throw Error(d.error||"Request failed");return d}
 function render(){chrome();if(tab==="topics")topics();else if(tab==="songs")songs();else cover()}
 function topics(){var v=document.getElementById("view");if(!plan){v.innerHTML='<section class="card center"><h2>Build any educational music project</h2><label>Subject or main topic</label><input id="topic" class="input" placeholder="Example: Grade 10 Mathematics or Transport Proteins"><div class="options"><div><label>Total number of songs</label><input id="count" class="input" type="number" min="1" max="100" value="40"></div><div><label>Maximum songs per album</label><input id="songsPerAlbum" class="input" type="number" min="1" max="20" value="10"></div></div><label>Organize the list</label><select id="organization"><option>Group into logical subject categories</option><option>One album with no subcategories</option><option>AI chooses the best organization</option></select><label>Album genre direction (optional)</label><input id="genreDirection" class="input" placeholder="Example: varied genres, or Zouk-Soul for every album"><p class="help">AI assigns a short sound family to each album. You can edit every genre before approval.</p><label>Your own topic list (optional)</label><textarea id="custom" class="custom" placeholder="Paste your formulas, proteins, historical events, vocabulary, or any required topics. One item per line works well."></textarea><label>Project and lyric instructions</label><textarea id="projectInstructions" class="custom" placeholder="Tell AI exactly how every song should teach. Example: Verse 1 explains the formula; Verse 2 introduces a problem; Verses 3 and 4 solve it; end with a real-world application."></textarea><p class="help">These instructions stay with the project and control every song.</p><label>Education level</label><select id="level"><option>College / Medical School</option><option>Grade 12</option><option>Grade 11</option><option>Grade 10</option><option>High School</option><option>Middle School</option><option>Elementary School</option><option>Adult / General</option></select><button id="makePlan" class="btn wide">✨ Create Exact Album and Song List</button></section>';document.getElementById("makePlan").onclick=makePlan;return}var h='<section class="card"><h2>'+esc(plan.topic)+'</h2><p class="help">Edit every instruction, album title, album genre, and song topic before approval.</p><label>Project and lyric instructions</label><textarea id="savedInstructions" class="custom">'+esc(plan.projectInstructions||"")+'</textarea><div class="plan">';plan.albums.forEach(function(a,x){h+='<article class="album"><div class="editrow"><input class="editable albumTitle" data-a="'+x+'" value="'+esc(a.title)+'"><button class="smallbtn danger deleteAlbum" data-a="'+x+'">Delete</button></div><label>Album Genre / Sound Family</label><input class="editable albumGenre" data-a="'+x+'" value="'+esc(a.genre||"World Fusion")+'">';a.songs.forEach(function(s,y){h+='<div class="editrow"><input class="editable songTitle" data-a="'+x+'" data-s="'+y+'" value="'+esc(s.title)+'"><button class="smallbtn danger deleteSong" data-a="'+x+'" data-s="'+y+'">×</button></div>'});h+='<button class="smallbtn addSong" data-a="'+x+'">+ Add song topic</button></article>'});h+='</div><div class="planActions"><button id="addAlbum" class="btn secondary">+ Add album / subcategory</button>'+(plan.approved?'<button id="toSongs" class="btn">Continue to Songs</button>':'<button id="approve" class="btn green">✓ Approve This Exact Plan</button>')+'</div></section>';v.innerHTML=h;wirePlanEditor();var go=document.getElementById("approve")||document.getElementById("toSongs");go.onclick=function(){syncPlan();if(!plan.albums.length||!totals().total){note("Add at least one album and song topic.");return}plan.approved=true;save();tab="songs";ai=si=0;render()}}
 function syncPlan(){var pi=document.getElementById("savedInstructions");if(pi)plan.projectInstructions=pi.value;document.querySelectorAll(".albumTitle").forEach(function(e){if(plan.albums[+e.dataset.a])plan.albums[+e.dataset.a].title=e.value.trim()||"Untitled Album"});document.querySelectorAll(".albumGenre").forEach(function(e){if(plan.albums[+e.dataset.a])plan.albums[+e.dataset.a].genre=e.value.trim()||"World Fusion"});document.querySelectorAll(".songTitle").forEach(function(e){var a=plan.albums[+e.dataset.a];if(a&&a.songs[+e.dataset.s])a.songs[+e.dataset.s].title=e.value.trim()||"Untitled Song Topic"});save()}
 function wirePlanEditor(){document.querySelectorAll(".editable").forEach(function(e){e.onchange=syncPlan});document.querySelectorAll(".deleteSong").forEach(function(b){b.onclick=function(){syncPlan();plan.albums[+b.dataset.a].songs.splice(+b.dataset.s,1);save();render()}});document.querySelectorAll(".deleteAlbum").forEach(function(b){b.onclick=function(){syncPlan();plan.albums.splice(+b.dataset.a,1);save();render()}});document.querySelectorAll(".addSong").forEach(function(b){b.onclick=function(){syncPlan();plan.albums[+b.dataset.a].songs.push({title:"New song topic"});save();render()}});document.getElementById("addAlbum").onclick=function(){syncPlan();plan.albums.push({title:plan.topic+" New Subcategory",genre:"World Fusion",songs:[{title:"New song topic"}]});save();render()}}
 async function makePlan(){if(busy)return;var topic=document.getElementById("topic").value.trim();if(!topic){note("Enter a topic first.");return}level=document.getElementById("level").value;var count=+document.getElementById("count").value||40,songsPerAlbum=+document.getElementById("songsPerAlbum").value||10,organization=document.getElementById("organization").value,custom=document.getElementById("custom").value,projectInstructions=document.getElementById("projectInstructions").value,genreDirection=document.getElementById("genreDirection").value;busy=true;note("AI is creating and independently verifying exactly "+count+" song topics…");try{var d=await call("/plan",{topic:topic,level:level,count:count,songsPerAlbum:songsPerAlbum,organization:organization,custom:custom,projectInstructions:projectInstructions,genreDirection:genreDirection});plan={topic:topic,level:level,projectInstructions:d.projectInstructions,verificationSummary:d.verificationSummary,verified:d.verified===true,albums:d.albums,approved:false};save();note("");render()}catch(e){note(e.message)}finally{busy=false}}
 function nav(){var h="";plan.albums.forEach(function(a,x){h+='<button class="albumBtn" data-a="'+x+'">'+esc(a.title)+'</button>';if(x===ai)a.songs.forEach(function(s,y){h+='<button class="'+(y===si?"active":"")+'" data-s="'+y+'">'+(s.completed?"✓ ":"")+(y+1)+". "+esc(s.title)+'</button>'})});return h}
 function wireNav(){document.querySelectorAll("[data-a]").forEach(function(b){b.onclick=function(){ai=+b.dataset.a;si=0;render()}});document.querySelectorAll("[data-s]").forEach(function(b){b.onclick=function(){si=+b.dataset.s;render()}})}
 function drawBrandLogo(ctx,img,cx,cy,size){var c=document.createElement("canvas"),x=c.getContext("2d");c.width=img.width;c.height=img.height;x.drawImage(img,0,0);var p=x.getImageData(0,0,c.width,c.height).data,minX=c.width,minY=c.height,maxX=0,maxY=0,found=false;for(var py=0;py<c.height;py+=2)for(var px=0;px<c.width;px+=2)if(p[(py*c.width+px)*4+3]>18){found=true;if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py}if(!found)return;var sw=maxX-minX+1,sh=maxY-minY+1,scale=Math.min((size-12)/sw,(size-12)/sh),dw=sw*scale,dh=sh*scale,left=cx-size/2,top=cy-size/2;ctx.save();ctx.fillStyle="#fff";ctx.fillRect(left,top,size,size);ctx.beginPath();ctx.rect(left,top,size,size);ctx.clip();ctx.drawImage(img,minX,minY,sw,sh,cx-dw/2,cy-dh/2,dw,dh);ctx.restore();ctx.strokeStyle="#f4c542";ctx.lineWidth=3;ctx.strokeRect(left,top,size,size)}
 function songs(){var a=plan.albums[ai],s=a.songs[si],main='<p><b>'+esc(a.title)+'</b><br><span class="help">Album sound: '+esc(a.genre||"World Fusion")+'</span></p><h2>'+esc(s.title)+'</h2>';if(!s.lyrics)main+='<div class="empty"><button id="makeSong" class="btn">✨ Create Song</button></div>';else main+='<div class="fieldHead"><h3>Song Name</h3><button class="btn secondary copy" data-copy="name">Copy Name</button></div><div class="copybox">'+esc(s.title)+'</div><div class="fieldHead"><h3>Genre</h3><button class="btn secondary copy" data-copy="genre">Copy Genre</button></div><textarea id="genre">'+esc(s.genre)+'</textarea><div class="fieldHead"><h3>Lyrics</h3><button class="btn secondary copy" data-copy="lyrics">Copy Lyrics</button></div><textarea id="lyrics" class="lyrics">'+esc(s.lyrics)+'</textarea><div class="actions"><button id="rewrite" class="btn secondary">Rewrite Song</button><button id="next" class="btn green">✓ Save and Open Next</button></div>';document.getElementById("view").innerHTML='<section class="work"><aside class="side"><h3>Albums and Songs</h3>'+nav()+'</aside><article class="main">'+main+'</article></section>';wireNav();var make=document.getElementById("makeSong"),rewrite=document.getElementById("rewrite");if(make)make.onclick=makeSong;if(rewrite)rewrite.onclick=makeSong;document.querySelectorAll(".copy").forEach(function(b){b.onclick=function(){var value=b.dataset.copy==="name"?s.title:b.dataset.copy==="genre"?document.getElementById("genre").value:document.getElementById("lyrics").value;navigator.clipboard.writeText(value);note("Copied.")}});var next=document.getElementById("next");if(next)next.onclick=function(){s.genre=document.getElementById("genre").value;s.lyrics=document.getElementById("lyrics").value;s.completed=true;save();if(si<a.songs.length-1)si++;else if(ai<plan.albums.length-1){ai++;si=0}else tab="cover";render()}}
 function musicResults(s){var m=s.music||{},h='<section class="musicbox"><h3>MusicGPT Audio</h3>';if(m.tracks&&m.tracks.length){h+='<p class="help">MusicGPT created two versions. Listen before choosing which one to keep.</p><div class="versions">';m.tracks.forEach(function(t){h+='<article class="version"><b>Version '+t.version+'</b><audio controls preload="none" src="'+esc(t.mp3)+'"></audio><div class="actions"><a class="btn green" href="'+esc(t.mp3)+'" target="_blank" rel="noopener">Download MP3</a>'+(t.wav?'<a class="btn secondary" href="'+esc(t.wav)+'" target="_blank" rel="noopener">Download WAV</a>':'')+'</div></article>'});return h+'</div><button id="generateMusic" class="btn secondary wide">Generate Two New Versions</button></section>'}if(m.taskId)return h+'<p><b>MusicGPT is creating two versions.</b></p><p class="help">This normally takes several minutes. You can safely leave this song and return later.</p><button id="checkMusic" class="btn wide">Check Music Status</button></section>';return h+'<p class="help">This securely sends the approved genre and lyrics to MusicGPT. One request creates two versions and uses API credit.</p><button id="generateMusic" class="btn wide">Generate Music with MusicGPT</button></section>'}
 function songs(){var a=plan.albums[ai],s=a.songs[si],main='<p><b>'+esc(a.title)+'</b><br><span class="help">Album sound: '+esc(a.genre||"World Fusion")+'</span></p><h2>'+esc(s.title)+'</h2>';if(!s.lyrics)main+='<div class="empty"><button id="makeSong" class="btn">✨ Create Song</button></div>';else main+='<div class="fieldHead"><h3>Song Name</h3><button class="btn secondary copy" data-copy="name">Copy Name</button></div><div class="copybox">'+esc(s.title)+'</div><div class="fieldHead"><h3>Genre</h3><button class="btn secondary copy" data-copy="genre">Copy Genre</button></div><textarea id="genre">'+esc(s.genre)+'</textarea><div class="fieldHead"><h3>Lyrics</h3><button class="btn secondary copy" data-copy="lyrics">Copy Lyrics</button></div><textarea id="lyrics" class="lyrics">'+esc(s.lyrics)+'</textarea>'+musicResults(s)+'<div class="actions"><button id="rewrite" class="btn secondary">Rewrite Song</button><button id="next" class="btn green">✓ Save and Open Next</button></div>';document.getElementById("view").innerHTML='<section class="work"><aside class="side"><h3>Albums and Songs</h3>'+nav()+'</aside><article class="main">'+main+'</article></section>';wireNav();var make=document.getElementById("makeSong"),rewrite=document.getElementById("rewrite"),generate=document.getElementById("generateMusic"),check=document.getElementById("checkMusic");if(make)make.onclick=makeSong;if(rewrite)rewrite.onclick=makeSong;if(generate)generate.onclick=generateMusic;if(check)check.onclick=checkMusic;document.querySelectorAll(".copy").forEach(function(b){b.onclick=function(){var value=b.dataset.copy==="name"?s.title:b.dataset.copy==="genre"?document.getElementById("genre").value:document.getElementById("lyrics").value;navigator.clipboard.writeText(value);note("Copied.")}});var next=document.getElementById("next");if(next)next.onclick=function(){s.genre=document.getElementById("genre").value;s.lyrics=document.getElementById("lyrics").value;s.completed=true;save();if(si<a.songs.length-1)si++;else if(ai<plan.albums.length-1){ai++;si=0}else tab="cover";render()}}
 async function generateMusic(){if(busy)return;var s=plan.albums[ai].songs[si];s.genre=document.getElementById("genre").value;s.lyrics=document.getElementById("lyrics").value;if(s.music&&s.music.taskId&&!confirm("Generate two new versions? This will use more MusicGPT credit."))return;busy=true;note("Sending the approved song to MusicGPT…");try{var d=await call("/music",{title:s.title,genre:s.genre,lyrics:s.lyrics});s.music={taskId:d.taskId,status:d.status||"QUEUED",eta:d.eta||null,creditEstimate:d.creditEstimate||null,tracks:[]};save();render();note("MusicGPT is creating two versions. Return in a few minutes and press Check Music Status.")}catch(e){note(e.message)}finally{busy=false}}
 async function checkMusic(){if(busy)return;var s=plan.albums[ai].songs[si];if(!(s.music&&s.music.taskId))return;busy=true;note("Checking MusicGPT…");try{var r=await fetch(API+"/music-status?task_id="+encodeURIComponent(s.music.taskId)),raw=await r.text(),d;try{d=JSON.parse(raw)}catch(e){throw Error("Cloudflare error "+r.status)}if(!r.ok)throw Error(d.error||"Status check failed");s.music.status=d.status;s.music.tracks=d.tracks||[];save();render();note(s.music.tracks.length?"Both MusicGPT versions are ready.":"Still creating the music. Please check again in about one minute.")}catch(e){note(e.message)}finally{busy=false}}
 async function makeSong(){if(busy)return;var a=plan.albums[ai],s=a.songs[si];busy=true;note("AI is writing the "+(plan.level||level)+" song…");try{var d=await call("/song",{topic:plan.topic,level:plan.level||level,projectInstructions:plan.projectInstructions||"",albumTitle:a.title,albumGenre:a.genre||"World Fusion",songTitle:s.title,albumSongs:a.songs.map(function(x){return x.title})});s.genre=d.genre;s.lyrics=d.lyrics;save();note("");render()}catch(e){note(e.message)}finally{busy=false}}
 function cover(){var a=plan.albums[ai],main='<h2>'+esc(a.title)+'</h2><p>Square educational artwork with the exact approved title added automatically.</p>';main+=a.cover?'<img class="cover" src="'+a.cover+'" alt="Album cover"><div class="actions"><button id="makeCover" class="btn secondary">Replace Cover (uses AI)</button><a class="btn green" style="text-align:center;text-decoration:none" href="'+a.cover+'" download="'+esc(a.title)+'.png">⬇ Download Cover</a></div>':'<div class="empty"><button id="makeCover" class="btn">🖼 Create Album Cover</button></div>';document.getElementById("view").innerHTML='<section class="work"><aside class="side"><h3>Choose Album</h3>'+plan.albums.map(function(x,n){return '<button class="albumBtn '+(n===ai?"active":"")+'" data-a="'+n+'">'+esc(x.title)+'</button>'}).join("")+'</aside><article class="main">'+main+'</article></section>';wireNav();document.getElementById("makeCover").onclick=makeCover}
 async function makeCover(){if(busy)return;busy=true;note("AI is creating the artwork. The builder will add the exact title and SaySayMusic branding…");try{var r=await fetch(API+"/cover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({topic:plan.topic,albumTitle:plan.albums[ai].title,albumGenre:plan.albums[ai].genre,albumSongs:plan.albums[ai].songs.map(function(s){return s.title})})});if(!r.ok){var raw=await r.text(),d;try{d=JSON.parse(raw)}catch(x){}throw Error(d&&d.error||"Cover failed with Cloudflare error "+r.status)}var blob=await r.blob();if(!blob.type.startsWith("image/")||blob.size<1000)throw Error("Cloudflare did not return a valid image. Please try again.");var bitmap=await createImageBitmap(blob),logoResponse=await fetch(API+"/logo"),logoBitmap=null;if(logoResponse.ok){var logoBlob=await logoResponse.blob();logoBitmap=await createImageBitmap(logoBlob)}var canvas=document.createElement("canvas"),ctx=canvas.getContext("2d"),title=plan.albums[ai].title;canvas.width=canvas.height=600;ctx.drawImage(bitmap,0,0,600,600);var shade=ctx.createLinearGradient(0,0,0,600);shade.addColorStop(0,"rgba(3,15,36,.88)");shade.addColorStop(.28,"rgba(3,15,36,.12)");shade.addColorStop(.68,"rgba(3,15,36,.10)");shade.addColorStop(1,"rgba(3,15,36,.92)");ctx.fillStyle=shade;ctx.fillRect(0,0,600,600);ctx.fillStyle="rgba(3,15,36,.96)";ctx.fillRect(0,0,600,145);ctx.fillRect(0,500,600,100);ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.shadowColor="rgba(0,0,0,.8)";ctx.shadowBlur=9;var words=title.split(/\s+/),lines=[],line="",fontSize=title.length>48?29:title.length>30?33:37;ctx.font="800 "+fontSize+"px Arial";words.forEach(function(word){var test=line?line+" "+word:word;if(ctx.measureText(test).width>510&&line){lines.push(line);line=word}else line=test});if(line)lines.push(line);var start=78-(lines.length-1)*fontSize*.55;lines.forEach(function(value,n){ctx.fillText(value,300,start+n*fontSize*1.12)});ctx.shadowBlur=5;if(logoBitmap)drawBrandLogo(ctx,logoBitmap,52,550,70);ctx.font="700 19px Arial";ctx.fillStyle="#f4c542";ctx.fillText("by SaySayMusic… Education Through Melody",350,550);ctx.shadowBlur=0;var url=canvas.toDataURL("image/png");plan.albums[ai].cover=url;var storageWarning=false;try{save()}catch(storageError){storageWarning=true}note(storageWarning?"Cover created. Download it now; browser storage is full.":"");render()}catch(e){note(e.message)}finally{busy=false}}
 document.querySelectorAll(".tab").forEach(function(b){b.onclick=function(){tab=b.dataset.tab;render()}});
 document.getElementById("newBtn").onclick=function(){if(confirm("Start a new topic and clear this project?")){localStorage.removeItem(KEY);plan=null;tab="topics";ai=si=0;note("");render()}};
 try{plan=JSON.parse(localStorage.getItem(KEY)||"null");if(plan&&plan.level)level=plan.level}catch(e){}render();
})();
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/" && request.method === "GET") {
        const user = await requireCreator(request);
        if (!user) return new Response("Please log into app.saysaymusic.com with a Creator or Administrator account, then open Music Builder again.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
        return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } });
      }
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/logo" && request.method === "GET") {
          const logo = await fetch(LOGO_URL);
          if (!logo.ok) return new Response("Logo unavailable", { status: 502 });
          return new Response(logo.body, { headers: { "content-type": logo.headers.get("content-type") || "image/png", "cache-control": "public, max-age=3600" } });
        }
        const user = await requireCreator(request);
        if (!user) return json({ error: "Creator or Administrator login required." }, 401);
        if (url.pathname === "/api/music-status" && request.method === "GET") return musicStatus(request, env);
        if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
        if (url.pathname === "/api/plan") return makePlan(request, env);
        if (url.pathname === "/api/song") return makeSong(request, env);
        if (url.pathname === "/api/music") return createMusic(request, env);
        if (url.pathname === "/api/cover") return makeCover(request, env);
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return json({ error: error && error.message ? error.message : "Music Builder failed." }, 500);
    }
  }
};
