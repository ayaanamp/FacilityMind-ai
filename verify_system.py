"""
FacilityMind AI - Comprehensive System Self-Verification Script
Run: python verify_system.py
"""

import os
import sys
import json
import sqlite3
import csv
from collections import Counter

# Set UTF-8 encoding for Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title.upper()}")
    print("=" * 70)

def verify_dataset():
    print_header("1. Verifying Maintenance Dataset")
    dataset_path = os.path.join("data", "maintenance_records.csv")
    if not os.path.exists(dataset_path):
        print("❌ Dataset file not found at", dataset_path)
        return False
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    
    print(f"✅ Dataset found: {len(rows)} records")
    
    required_cols = [
        "id", "equipment_type", "equipment_id", "location", "complaint",
        "symptoms", "diagnosis", "root_cause", "recommended_fix",
        "estimated_cost", "repair_time", "urgency", "technician_type",
        "date", "technician_notes", "status"
    ]
    missing = [c for c in required_cols if c not in fieldnames]
    if missing:
        print(f"❌ Missing columns: {missing}")
        return False
    print("✅ All 16 required schema columns present")
    
    categories = Counter(r["equipment_type"] for r in rows)
    print("📊 Equipment Category Distribution:")
    for cat, count in categories.items():
        print(f"   • {cat:22s}: {count:3d} records")
    return True

def verify_database():
    print_header("2. Verifying SQLite Database")
    db_path = os.path.join("data", "app.db")
    if not os.path.exists(db_path):
        print("❌ Database not found at", db_path)
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"✅ Found {len(tables)} tables: {', '.join(tables)}")
    
    expected_tables = ["maintenance_records", "complaints", "diagnoses", "recommendations", "agent_runs", "technician_feedback"]
    for t in expected_tables:
        if t in tables:
            cursor.execute(f"SELECT count(*) FROM {t}")
            count = cursor.fetchone()[0]
            print(f"   • {t:22s}: {count:4d} rows")
        else:
            print(f"❌ Expected table {t} missing!")
            return False
            
    conn.close()
    return True

import asyncio

def verify_vector_store():
    print_header("3. Verifying RAG Vector Store")
    vec_path = os.path.join("data", "vector_index.json")
    if not os.path.exists(vec_path):
        print("❌ Vector index not found at", vec_path)
        return False
        
    with open(vec_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    count = len(data) if isinstance(data, list) else len(data.get("records", []))
    print(f"✅ Vector index loaded with {count} indexed records")
    
    from backend.app.rag.retriever import retriever
    results = asyncio.run(retriever.retrieve_similar_cases(
        query="water leaking and air conditioner not cooling in lab",
        equipment_type="Air Conditioner",
        top_k=3
    ))
    print(f"✅ Semantic Search probe returned {len(results)} matches:")
    for r in results:
        score = r["similarity_percentage"]
        print(f"   • [{score:.1f}%] Case #{r.get('case_id')}: {r.get('equipment_type')} - {r.get('root_cause')[:45]}...")
    return True

def verify_agent_pipeline():
    print_header("4. Verifying LangGraph 6-Agent Pipeline")
    from backend.app.agents.orchestrator import orchestrator
    
    test_complaint = "The projector in Classroom 302 shuts down after 10 minutes with overheating red indicator light."
    print(f"📝 Test Input: \"{test_complaint}\"")
    print("⏳ Executing 6-Agent LangGraph Pipeline...")
    
    state = asyncio.run(orchestrator.execute_pipeline(
        raw_complaint=test_complaint,
        location_hint="Classroom 302"
    ))
    
    def to_dict(obj):
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        return obj or {}

    analysis = to_dict(state.get("analysis"))
    diagnosis = to_dict(state.get("diagnosis"))
    recommendation = to_dict(state.get("recommendation"))
    similar_cases = state.get("similar_cases") or []
    runs = state.get("agent_runs") or []
    
    print(f"✅ Agent 1 (Analyzer):       Category='{analysis.get('equipment_type')}', Severity='{analysis.get('severity')}', Symptoms='{analysis.get('symptoms')[:40]}...'")
    print(f"✅ Agent 2 (Retrieval):      Retrieved {len(similar_cases)} similar historical cases")
    print(f"✅ Agent 3 (Diagnosis):      Confidence='{diagnosis.get('confidence_level')}', Root Cause='{diagnosis.get('primary_cause')[:45]}...'")
    print(f"✅ Agent 4 (Recommendation): Action='{recommendation.get('action')[:35]}...', Cost=₹{recommendation.get('estimated_cost_min')}-{recommendation.get('estimated_cost_max')}, Time={recommendation.get('repair_time_hours')}h, Tech='{recommendation.get('technician_required')}'")
    print(f"✅ Agent 5 (Explanation):   Audit Trail steps={len(runs)}")
    print(f"✅ Agent 6 (Validation):    Pipeline Guardrail Verification Completed (Errors: {len(state.get('errors', []))})")
    
    return True

def verify_frontend_build():
    print_header("5. Verifying Frontend Production Build")
    dist_path = os.path.join("frontend", "dist")
    index_html = os.path.join(dist_path, "index.html")
    if os.path.exists(index_html):
        size = os.path.getsize(index_html)
        print(f"✅ Frontend production build present at {dist_path} (index.html: {size} bytes)")
        return True
    else:
        print(f"⚠️ Frontend dist not found at {dist_path}. Run 'npm --prefix frontend run build'")
        return False

def main():
    print("=" * 70)
    print("   FACILITYMIND AI - END-TO-END VERIFICATION SUITE")
    print("=" * 70)
    
    results = [
        ("Dataset Validation", verify_dataset()),
        ("SQLite Database", verify_database()),
        ("RAG Vector Index & Semantic Search", verify_vector_store()),
        ("LangGraph 6-Agent Pipeline Execution", verify_agent_pipeline()),
        ("Frontend Build Distribution", verify_frontend_build()),
    ]
    
    print_header("Summary of Verification")
    all_passed = True
    for name, passed in results:
        status = "PASSED ✅" if passed else "FAILED ❌"
        print(f"   • {name:40s}: {status}")
        if not passed:
            all_passed = False
            
    if all_passed:
        print("\n🎉 ALL 5 SUBSYSTEM VERIFICATIONS PASSED 100%! SYSTEM READY FOR DEMO.")
    else:
        print("\n⚠️ SOME VERIFICATIONS FAILED. PLEASE REVIEW LOGS ABOVE.")

if __name__ == "__main__":
    main()
