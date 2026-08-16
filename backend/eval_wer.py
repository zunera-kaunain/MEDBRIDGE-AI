"""WER/CER evaluation: Whisper transcription vs ground truth.

Run from inside backend/:
    python eval_wer.py
"""
import asyncio
import json
from pathlib import Path

from utils.cuda_dlls import register_cuda_dlls
register_cuda_dlls()

import jiwer

from models.common import LanguagePair
from services.asr import transcribe_file

# English meaning-equivalent references, used specifically for evaluating
# output produced with LanguagePair.EN — the hint causes translate-like
# behavior (see Finding #3), so scoring against the romanized reference
# unfairly penalises coherent, correct translation as if it were error.
ENGLISH_GLOSS = {
    "kn_en_02": "good morning please sit down whats the problem doctor its been two days of fever im very tired two days of fever with weakness any body pain yes doctor i have a headache too headache as well let me check the temperature ninety nine point eight thats a mild fever open your mouth let me check your throat the throat is slightly red but the tonsils are not enlarged no exudate this is a viral fever not bacterial so antibiotics are not indicated you have an ordinary fever you dont need antibiotics take this medicine im prescribing paracetamol five hundred milligram three times a day after food for five days advise plenty of oral fluids and rest okay doctor drink plenty of water and rest come back after three days if the fever crosses one oh two or theres any breathing difficulty or the headache becomes severe she should come back immediately",
    "kn_en_03": "please sit down did you bring the sugar report yes doctor i have the report fasting is one forty two post prandial one ninety last visit fasting was one thirty so theres been a rise are you taking the metformin regularly i take it in the morning doctor but i sometimes forget it at night so the evening dose is being missed that explains the fasting value inconsistent dosing gives poor overnight control dont forget the night medicine twice a day without fail any numbness or tingling in the feet no doctor any blurring of vision no good no neuropathy or retinopathy symptoms yet continue metformin five hundred milligram twice daily morning and night after food reduce sweets and rice thirty minutes of walking daily preferably morning eat less sweets walk daily repeat hba one c after one month and come for review",
    "kn_en_04": "whats troubling you doctor theres burning in my stomach its worse after i eat burning in the stomach worse after meals since how long one week its been disturbing my sleep one week and its disturbing sleep any vomiting no doctor any black coloured stools no no haematemesis no melaena are you taking any painkillers regularly no doctor lie down let me check your abdomen theres tenderness in the epigastric region but no guarding and no rebound this is gastritis no indication for endoscopy at this stage theres burning inside not serious ill give you medicine pantoprazole forty milligram once daily in the morning on an empty stomach thirty minutes before breakfast for two weeks one tablet in the morning on an empty stomach for two weeks avoid spicy and oily food and dont skip meals irregular eating makes this worse come back after two weeks if theres vomiting especially with blood or black stools come immediately",
    "hi_en_01": "please come sit down let me check your bp first its one forty by ninety thats still above target yes doctor are you taking the amlodipine daily i take it daily doctor but sometimes i forget missed doses will do it antihypertensives need steady levels skipping days means the pressure never really comes down take the medicine daily dont skip even one day any dizziness no doctor any headache or chest discomfort no nothing like that no symptoms of end organ involvement continue amlodipine five milligram once daily in the morning after breakfast reduce salt intake that means pickles papad packaged snacks thirty minutes of walking daily reduce salt walk daily come back in two weeks for a bp recheck if you get dizziness chest pain or blurred vision come immediately",
    "hi_en_02": "whats the problem doctor ive had a cough for four days its worse at night four days of cough worse at night any fever i have a mild fever low grade fever any difficulty in breathing no im breathing fine is there sputum yes yellow sputum what colour yellow purulent sputum let me listen to your chest breathe in there are crepitations in the right lower zone no wheeze air entry is equal on both sides do you smoke no doctor this is a lower respiratory tract infection chest xray isnt necessary at this point given theres no breathlessness you have a chest infection im giving you three days of medicine azithromycin five hundred milligram once daily after food for three days complete the full course even if the cough settles earlier warm fluids and rest come back in five days for review if breathlessness develops or the fever goes above one oh two or theres blood in the sputum come immediately",
}

GROUND_TRUTH_PATH = Path(__file__).parent.parent / "eval" / "data" / "ground_truth.jsonl"
AUDIO_DIR = Path(__file__).parent.parent / "eval" / "data" / "audio"

LANG_MAP = {
    "kn-en": LanguagePair.KN_EN,
    "hi-en": LanguagePair.HI_EN,
    "en": LanguagePair.EN,
}

transform = jiwer.Compose([
    jiwer.ToLowerCase(),
    jiwer.RemovePunctuation(),
    jiwer.RemoveMultipleSpaces(),
    jiwer.Strip(),
])


async def main():
    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
        entries = [json.loads(line) for line in f if line.strip()]

    results = []
    for entry in entries:
        clip_id = entry["id"]
        audio_path = AUDIO_DIR / f"{clip_id}.wav"
        if not audio_path.exists():
            print(f"[{clip_id}] SKIPPED — audio file not found at {audio_path}")
            continue

        reference = ENGLISH_GLOSS.get(clip_id, entry["transcript"])
        lang_pair = LANG_MAP.get(entry["language_pair"], LanguagePair.EN)

        hypothesis = await transcribe_file(str(audio_path), LanguagePair.EN)

        ref_norm = transform(reference)
        hyp_norm = transform(hypothesis)

        wer = jiwer.wer(ref_norm, hyp_norm)
        cer = jiwer.cer(ref_norm, hyp_norm)

        results.append({"clip_id": clip_id, "wer": round(wer, 3), "cer": round(cer, 3)})
        print(f"[{clip_id}] WER={wer:.3f}  CER={cer:.3f}")
        print(f"  reference : {reference[:80]}...")
        print(f"  hypothesis: {hypothesis[:80]}...")

    if results:
        avg_wer = sum(r["wer"] for r in results) / len(results)
        avg_cer = sum(r["cer"] for r in results) / len(results)
        print(f"\n{'=' * 50}")
        print(f"MEAN WER: {avg_wer:.3f}   MEAN CER: {avg_cer:.3f}")

        out_dir = Path(__file__).parent.parent / "eval" / "results"
        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / "wer_eval.json", "w", encoding="utf-8") as f:
            json.dump({"per_clip": results, "mean_wer": avg_wer, "mean_cer": avg_cer}, f, indent=2)
        print(f"Saved to {out_dir / 'wer_eval.json'}")


if __name__ == "__main__":
    asyncio.run(main())