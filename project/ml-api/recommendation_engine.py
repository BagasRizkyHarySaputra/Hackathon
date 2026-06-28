"""
LICIN Recommendation Engine
Smart skincare recommendation based on:
- Acne severity (count)
- Acne location (face zones)
- Acne types (nodules, pustules, papules, dark_spot, blackheads, whiteheads)
- Budget consideration
"""

import json
from typing import Dict, List, Any, Tuple
from pathlib import Path

# Product database paths
DATA_DIR = Path(__file__).parent / "data"
PAGI_JSON = DATA_DIR / "pagi.json"
MALAM_JSON = DATA_DIR / "malam.json"


class RecommendationEngine:
    def __init__(self):
        self.pagi_products = self._load_json(PAGI_JSON)
        self.malam_products = self._load_json(MALAM_JSON)
    
    def _load_json(self, path: Path) -> Dict:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def classify_severity(self, total_acne: int) -> str:
        """Classify acne severity based on total count."""
        if total_acne == 0:
            return "clear"
        elif total_acne <= 5:
            return "mild"
        elif total_acne <= 15:
            return "moderate"
        else:
            return "severe"
    
    def determine_needed_categories(
        self, 
        severity: str, 
        acne_types: List[str]
    ) -> Dict[str, List[str]]:
        """
        Determine which skincare categories are needed.
        Returns dict with 'pagi' and 'malam' category lists.
        """
        # Baseline (always needed)
        pagi_needed = ["cleanser", "moisturizer", "sunscreen"]
        malam_needed = ["second_cleanser"]
        
        if severity == "clear":
            # Basic routine only
            return {"pagi": pagi_needed, "malam": malam_needed}
        
        # Conditional additions based on acne types and severity
        has_comedones = any(t in acne_types for t in ["blackheads", "whiteheads"])
        has_active_acne = any(t in acne_types for t in ["pustules", "papules", "nodules"])
        has_dark_spot = "dark_spot" in acne_types
        
        # Toner: needed if comedones present (exfoliation)
        if has_comedones:
            pagi_needed.append("toner")
        
        # Serum (morning): needed if dark spots present (brightening)
        if has_dark_spot:
            pagi_needed.append("serum")
        
        # Spot treatment: needed if active acne present
        if has_active_acne and severity in ["moderate", "severe"]:
            pagi_needed.append("spot_treatment")
        
        # Night routine additions
        # First cleanser: needed if moderate/severe (double cleansing)
        if severity in ["moderate", "severe"]:
            malam_needed.insert(0, "first_cleanser")
        
        # Night serum: needed if moderate/severe acne
        if severity in ["moderate", "severe"]:
            malam_needed.append("serum")
        
        # Face mist: optional, only for mild cases with budget
        # (will be added later if budget allows)
        
        return {"pagi": pagi_needed, "malam": malam_needed}
    
    def score_product_match(
        self, 
        product: Dict, 
        detected_issues: List[str]
    ) -> Tuple[int, int]:
        """
        Score product relevance.
        Returns (matched_count, coverage_score).
        """
        product_targets = set(product.get("masalah", []))
        detected_set = set(detected_issues)
        
        matched = product_targets & detected_set
        matched_count = len(matched)
        coverage_score = product.get("problem_coverage", 0)
        
        return (matched_count, coverage_score)
    
    def rank_products(
        self,
        products: List[Dict],
        detected_issues: List[str],
        budget_level: str = "standard"
    ) -> List[Dict]:
        """
        Rank products by relevance and budget.
        Returns top 3 options sorted by score.
        """
        if not products:
            return []
        
        # Score each product
        scored = []
        for product in products:
            matched_count, coverage_score = self.score_product_match(
                product, detected_issues
            )
            
            # Skip products with no match (unless no issues detected at all)
            if matched_count == 0 and len(detected_issues) > 0:
                continue
            
            # Extract price (remove "Rp" and "." and "k" suffix)
            price_str = product.get("harga", "Rp0")
            price_str = price_str.replace("Rp", "").replace(".", "").replace("k", "000").strip()
            price = int(price_str) if price_str.isdigit() else 999999
            
            # Composite score: prioritize match count, then coverage, then lower price
            score = (matched_count * 100) + (coverage_score * 10) - (price / 10000)
            
            scored.append({
                **product,
                "_score": score,
                "_matched_count": matched_count,
                "_price_num": price
            })
        
        # Sort by score descending
        scored.sort(key=lambda x: x["_score"], reverse=True)
        
        # Budget filtering
        if budget_level == "economy":
            # Filter to lower 60% price range
            if scored:
                max_price = max(p["_price_num"] for p in scored)
                scored = [p for p in scored if p["_price_num"] <= max_price * 0.6]
        elif budget_level == "premium":
            # No filtering, allow all
            pass
        # "standard" - keep all, sorted by score already balances price
        
        # Return top 3
        return scored[:3]
    
    def calculate_total_cost(self, recommendations: Dict) -> int:
        """Calculate total cost of recommended products."""
        total = 0
        for routine in ["pagi", "malam"]:
            for category_data in recommendations.get(routine, {}).values():
                if category_data["options"]:
                    # Use first (recommended) option
                    price = category_data["options"][0]["_price_num"]
                    total += price
        return total
    
    def generate_recommendations(
        self,
        ml_result: Dict,
        budget_level: str = "standard"
    ) -> Dict[str, Any]:
        """
        Generate skincare recommendations based on ML analysis.
        
        Args:
            ml_result: ML API response with acne_counts, issues_found, grid_stats
            budget_level: "economy", "standard", or "premium"
        
        Returns:
            Structured recommendation with pagi/malam routines
        """
        # Extract data from ML result
        acne_counts = ml_result.get("acne_counts", {})
        detected_issues = ml_result.get("issues_found", [])
        total_acne = sum(acne_counts.values())
        
        # Classify severity
        severity = self.classify_severity(total_acne)
        
        # Determine needed categories
        needed = self.determine_needed_categories(severity, detected_issues)
        
        # Build recommendations
        recommendations = {
            "severity": severity,
            "total_acne": total_acne,
            "detected_issues": detected_issues,
            "budget_level": budget_level,
            "pagi": {},
            "malam": {}
        }
        
        # Pagi (morning) routine
        for category in needed["pagi"]:
            products = self.pagi_products.get(category, [])
            ranked = self.rank_products(products, detected_issues, budget_level)
            
            recommendations["pagi"][category] = {
                "needed": True,
                "reason": self._get_category_reason(category, severity, detected_issues),
                "options": ranked
            }
        
        # Malam (night) routine
        for category in needed["malam"]:
            products = self.malam_products.get(category, [])
            ranked = self.rank_products(products, detected_issues, budget_level)
            
            recommendations["malam"][category] = {
                "needed": True,
                "reason": self._get_category_reason(category, severity, detected_issues),
                "options": ranked
            }
        
        # Calculate total cost
        recommendations["estimated_cost"] = self.calculate_total_cost(recommendations)
        
        # Add budget advice
        if recommendations["estimated_cost"] > 500000:
            recommendations["budget_advice"] = "Biaya cukup tinggi. Pertimbangkan pilih produk alternatif yang lebih terjangkau."
        elif recommendations["estimated_cost"] < 200000:
            recommendations["budget_advice"] = "Rutinitas ini sangat terjangkau untuk pemula."
        else:
            recommendations["budget_advice"] = "Biaya sesuai untuk rutinitas skincare acne-prone yang efektif."
        
        return recommendations
    
    def _get_category_reason(
        self, 
        category: str, 
        severity: str, 
        issues: List[str]
    ) -> str:
        """Generate human-readable reason for category inclusion."""
        reasons = {
            "cleanser": "Pembersih wajah adalah dasar skincare untuk membersihkan kotoran dan minyak.",
            "moisturizer": "Pelembap menjaga skin barrier dan mencegah kulit kering akibat produk acne.",
            "sunscreen": "Sunscreen wajib untuk melindungi kulit dari UV dan mencegah dark spot bertambah parah.",
            "toner": "Toner eksfoliasi membantu membersihkan pori-pori dan mengurangi komedo.",
            "serum": "Serum memberikan treatment intensif untuk masalah spesifik kulitmu.",
            "spot_treatment": "Spot treatment mengatasi jerawat aktif dengan cepat dan efektif.",
            "face_mist": "Face mist menyegarkan dan menghidrasi kulit sepanjang hari.",
            "first_cleanser": "Oil cleanser menghapus makeup dan sunscreen sebelum cuci muka.",
            "second_cleanser": "Facial wash membersihkan sisa kotoran dan minyak di malam hari."
        }
        return reasons.get(category, "Produk ini membantu merawat kulitmu.")


# Standalone testing
if __name__ == "__main__":
    # Example ML result
    example_ml_result = {
        "acne_counts": {
            "papules": 8,
            "dark_spot": 12,
            "whiteheads": 5
        },
        "issues_found": ["papules", "dark_spot", "whiteheads"],
        "grid_stats": [
            {"grid_id": 4, "face_zone": "Hidung/T-zone", "acne_count": 10},
            {"grid_id": 3, "face_zone": "Pipi Kiri", "acne_count": 8},
            {"grid_id": 5, "face_zone": "Pipi Kanan", "acne_count": 7}
        ]
    }
    
    engine = RecommendationEngine()
    result = engine.generate_recommendations(example_ml_result, budget_level="standard")
    
    print(json.dumps(result, indent=2, ensure_ascii=False))
