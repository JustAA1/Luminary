import asyncio
import os
import sys
import uuid
import time
from datetime import datetime, timedelta

# Needs to be able to import riqe
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from riqe.config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client

def get_user_id(client, email):
    # Hardcoded UUID from the Google OAuth signin session bypassing RLS restrictions
    return "4ed78ec7-16b4-414f-8f53-ea6c632dfbff"

async def main():
    print(f"Connecting to Supabase at {SUPABASE_URL}")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    email = "tushsood@gmail.com"
    try:
        user_id = get_user_id(client, email)
        print(f"Found user ID for {email}: {user_id}")
    except Exception as e:
        print(e)
        return

    print("Generating simulated roadmaps...")
    
    # Generate 10 roadmaps showing progression for a CS student learning ML/Quant
    
    base_topics = [
        {"id": "python-basics", "title": "Python Basics"},
        {"id": "linear-algebra", "title": "Linear Algebra for ML"},
        {"id": "statistics", "title": "Statistical Foundations"},
        {"id": "pandas-numpy", "title": "Data Manipulation (Pandas & Numpy)"},
        {"id": "machine-learning-intro", "title": "Introduction to Machine Learning"},
        {"id": "deep-learning-intro", "title": "Neural Networks & Deep Learning"},
        {"id": "pytorch-fundamentals", "title": "PyTorch Fundamentals"},
        {"id": "time-series-analysis", "title": "Time Series Analysis"},
        {"id": "quant-finance-basics", "title": "Quantitative Finance Basics"},
        {"id": "algorithmic-trading", "title": "Algorithmic Trading Strategies"},
    ]

    base_time = datetime.utcnow() - timedelta(days=60)
    
    for i in range(10):
        roadmap_id = str(uuid.uuid4())
        created_at = (base_time + timedelta(days=i*6)).isoformat()
        
        # Gradually increase progress and topics
        num_nodes = min(5 + i, len(base_topics))
        
        nodes = []
        for j in range(num_nodes):
            status = "completed" if j < i else ("in-progress" if j == i else "upcoming")
            nodes.append({
                "id": base_topics[j]["id"],
                "title": base_topics[j]["title"],
                "description": f"Learn about {base_topics[j]['title']}",
                "status": status,
                "recommendation_score": min(0.99, 0.4 + (j * 0.05) + (i * 0.02)),
                "signal_score": min(0.99, 0.5 + (i * 0.03)),
                "confidence": min(0.99, 0.6 + (i * 0.03)),
                "difficulty": min(0.99, 0.3 + (j * 0.08)),
                "why_this": f"Based on your CS background and recent signals, {base_topics[j]['title']} is the optimal next step."
            })

        roadmap_data = {
            "roadmap_id": roadmap_id,
            "user_id": user_id,
            "version": i + 1,
            "quality_score": min(0.95, 0.6 + (i * 0.04)),
            "nodes": nodes,
            "created_at": created_at
        }
        
        # Insert roadmap
        client.table("roadmaps").insert(roadmap_data).execute()
        
        # Insert snapshot
        snapshot_data = {
            "user_id": user_id,
            "roadmap_id": roadmap_id,
            "course_names": [n["title"] for n in nodes]
        }
        client.table("roadmap_snapshots").insert(snapshot_data).execute()
        
        # Insert a signal that triggered this roadmap
        signal_data = {
            "user_id": user_id,
            "text": f"Finished studying {base_topics[max(0, i-1)]['title']} and looking to dive deeper.",
            "topic": base_topics[min(i, len(base_topics)-1)]["id"],
            "strength": 0.85,
            "signal_type": "reinforcement",
            "trend": "rising",
            "reliability_score": 0.9,
            "timestamp": created_at
        }
        client.table("signals").insert(signal_data).execute()
        
        # Insert a metric snapshot
        metrics_data = {
            "user_id": user_id,
            "roadmap_quality_score": min(0.99, 0.6 + (i * 0.04)),
            "signal_reliability": min(0.99, 0.5 + (i * 0.05)),
            "knowledge_state_drift": max(0.01, 0.2 - (i * 0.01)),
            "topic_coverage": min(0.99, 0.1 + (i * 0.08)),
            "recommendation_consistency": min(0.99, 0.7 + (i * 0.02)),
            "created_at": created_at
        }
        client.table("metrics").insert(metrics_data).execute()
        
        print(f"Generated Roadmap {i+1}/10 (Version {i+1})")

    print("Successfully generated 10 simulated scenarios for deep learning and quant finance.")

if __name__ == "__main__":
    asyncio.run(main())
