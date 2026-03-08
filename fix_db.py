import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client

def run():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials")
        return
        
    supabase = create_client(url, key)
    
    print("Fetching roadmaps...")
    resp = supabase.table("roadmaps").select("*").execute()
    roadmaps = resp.data
    
    print(f"Found {len(roadmaps)} roadmaps")
    fixes = 0
    
    for r in roadmaps:
        nodes = r.get("nodes", [])
        if not nodes:
            continue
            
        changed = False
        for n in nodes:
            if n.get("recommendation_score", 0) < 0:
                n["recommendation_score"] = max(0.0, float(n["recommendation_score"]))
                changed = True
                
        if changed:
            print(f"Updating roadmap {r.get('roadmap_id')}...")
            supabase.table("roadmaps").update({"nodes": nodes}).eq("roadmap_id", r["roadmap_id"]).execute()
            fixes += 1
            
    print(f"Finished fixing {fixes} roadmaps with negative scores.")

if __name__ == "__main__":
    run()
