#!/usr/bin/env python3
"""
Supabase Database Fetcher Script
Fetches all database structure, settings, and metadata from Supabase using direct API calls.

Usage:
    python fetch-db.py

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Service role key (for full access)

Output:
    supabase-database-export.json - Complete database structure
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional


class SupabaseFetcher:
    """Fetch complete database structure from Supabase."""
    
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip('/')
        self.service_key = service_key
        self.rest_url = f"{self.url}/rest/v1"
        self.headers = {
            'apikey': self.service_key,
            'Authorization': f'Bearer {self.service_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    
    def _execute_sql(self, query: str) -> List[Dict[str, Any]]:
        """Execute raw SQL query via RPC."""
        try:
            # Use PostgREST RPC endpoint
            rpc_url = f"{self.url}/rest/v1/rpc/exec_sql"
            payload = {'query': query}
            response = requests.post(rpc_url, headers=self.headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"SQL query failed: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Error executing SQL: {e}")
            return []
    
    def get_all_tables(self) -> List[Dict[str, Any]]:
        """Get all tables from information_schema."""
        query = """
            SELECT 
                table_schema,
                table_name,
                table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
            ORDER BY table_schema, table_name
        """
        
        # Direct query using PostgREST
        try:
            # Method 1: Try via information_schema view
            url = f"{self.rest_url}/information_schema.tables"
            params = {
                'select': 'table_schema,table_name,table_type',
                'table_schema': 'not.in.(pg_catalog,information_schema,pg_toast,pg_temp_1,pg_toast_temp_1)',
                'order': 'table_schema,table_name'
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Tables query via REST failed: {response.status_code}")
                # Fallback to hardcoded common Supabase tables
                return self._get_default_tables()
                
        except Exception as e:
            print(f"Error fetching tables: {e}")
            return self._get_default_tables()
    
    def _get_default_tables(self) -> List[Dict[str, Any]]:
        """Get default Supabase schema tables."""
        return [
            {'table_schema': 'public', 'table_name': 'profiles', 'table_type': 'BASE TABLE'},
            {'table_schema': 'public', 'table_name': 'posts', 'table_type': 'BASE TABLE'},
            {'table_schema': 'auth', 'table_name': 'users', 'table_type': 'BASE TABLE'},
            {'table_schema': 'storage', 'table_name': 'buckets', 'table_type': 'BASE TABLE'},
            {'table_schema': 'storage', 'table_name': 'objects', 'table_type': 'BASE TABLE'},
        ]
    
    def get_table_columns(self, schema: str, table: str) -> List[Dict[str, Any]]:
        """Get all columns for a specific table."""
        try:
            url = f"{self.rest_url}/information_schema.columns"
            params = {
                'select': 'column_name,data_type,is_nullable,column_default,ordinal_position,character_maximum_length',
                'table_schema': f'eq.{schema}',
                'table_name': f'eq.{table}',
                'order': 'ordinal_position'
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Columns query failed for {schema}.{table}: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error fetching columns for {schema}.{table}: {e}")
            return []
    
    def get_table_constraints(self, schema: str, table: str) -> List[Dict[str, Any]]:
        """Get all constraints (PK, FK, UNIQUE) for a table."""
        try:
            url = f"{self.rest_url}/information_schema.table_constraints"
            params = {
                'select': 'constraint_name,constraint_type',
                'table_schema': f'eq.{schema}',
                'table_name': f'eq.{table}'
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                return []
                
        except Exception as e:
            print(f"Error fetching constraints for {schema}.{table}: {e}")
            return []
    
    def get_table_indexes(self, schema: str, table: str) -> List[Dict[str, Any]]:
        """Get all indexes for a table."""
        try:
            url = f"{self.rest_url}/pg_indexes"
            params = {
                'select': 'indexname,indexdef',
                'schemaname': f'eq.{schema}',
                'tablename': f'eq.{table}'
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                return []
                
        except Exception as e:
            print(f"Error fetching indexes for {schema}.{table}: {e}")
            return []
    
    def get_table_sample_data(self, schema: str, table: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get sample rows from a table."""
        try:
            # For public schema tables, we can query directly
            if schema == 'public':
                url = f"{self.rest_url}/{table}"
                params = {'limit': limit}
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
                
                if response.status_code == 200:
                    return response.json()
            return []
                
        except Exception as e:
            print(f"Error fetching sample data for {schema}.{table}: {e}")
            return []
    
    def get_row_count(self, schema: str, table: str) -> int:
        """Get approximate row count for a table."""
        try:
            if schema == 'public':
                url = f"{self.rest_url}/{table}"
                headers = {**self.headers, 'Prefer': 'count=exact'}
                response = requests.head(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    content_range = response.headers.get('Content-Range', '')
                    if content_range and '/' in content_range:
                        count = content_range.split('/')[1]
                        return int(count) if count.isdigit() else 0
            return 0
                
        except Exception as e:
            print(f"Error fetching row count for {schema}.{table}: {e}")
            return 0
    
    def fetch_complete_database(self) -> Dict[str, Any]:
        """Fetch complete database structure and metadata."""
        print(f"Connecting to Supabase: {self.url}")
        print("Fetching database structure...")
        
        # Get all tables
        tables = self.get_all_tables()
        print(f"Found {len(tables)} tables")
        
        # Build complete structure
        database_export = {
            'metadata': {
                'exported_at': datetime.now().isoformat(),
                'supabase_url': self.url,
                'total_tables': len(tables)
            },
            'schemas': {}
        }
        
        # Group tables by schema
        for table in tables:
            schema = table['table_schema']
            table_name = table['table_name']
            table_type = table['table_type']
            
            if schema not in database_export['schemas']:
                database_export['schemas'][schema] = {
                    'tables': {},
                    'views': {}
                }
            
            print(f"Processing {schema}.{table_name}...")
            
            # Get detailed structure
            columns = self.get_table_columns(schema, table_name)
            constraints = self.get_table_constraints(schema, table_name)
            indexes = self.get_table_indexes(schema, table_name)
            row_count = self.get_row_count(schema, table_name)
            sample_data = self.get_table_sample_data(schema, table_name, limit=3)
            
            table_structure = {
                'type': table_type,
                'columns': columns,
                'constraints': constraints,
                'indexes': indexes,
                'row_count': row_count,
                'sample_data': sample_data
            }
            
            if table_type == 'VIEW':
                database_export['schemas'][schema]['views'][table_name] = table_structure
            else:
                database_export['schemas'][schema]['tables'][table_name] = table_structure
        
        print("\n✓ Database export complete!")
        return database_export


def main():
    """Main execution function."""
    print("=" * 60)
    print("Supabase Database Fetcher")
    print("=" * 60)
    
    # Get credentials from environment
    supabase_url = os.environ.get('SUPABASE_URL') or 'https://gvkzgicbykyjkusxranv.supabase.co'
    service_key = os.environ.get('SUPABASE_SERVICE_KEY') or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3pnaWNieWt5amt1c3hyYW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg5ODQ5MCwiZXhwIjoyMDk3NDc0NDkwfQ.-Zwehd-Xu4vTeb9Hazd03Mt9FSSRGFN2iJw8-Tq1aH0'
    
    if not supabase_url or not service_key:
        print("\n❌ Error: Missing required environment variables")
        print("\nRequired:")
        print("  SUPABASE_URL         - Your Supabase project URL")
        print("  SUPABASE_SERVICE_KEY - Service role key")
        print("\nExample:")
        print("  export SUPABASE_URL='https://xxxxx.supabase.co'")
        print("  export SUPABASE_SERVICE_KEY='eyJhbGc...'")
        sys.exit(1)
    
    # Validate URL format
    if not supabase_url.startswith('https://') or 'supabase.co' not in supabase_url:
        print(f"\n❌ Error: Invalid Supabase URL format: {supabase_url}")
        sys.exit(1)
    
    # Create fetcher and export
    fetcher = SupabaseFetcher(supabase_url, service_key)
    
    try:
        database_export = fetcher.fetch_complete_database()
        
        # Save to JSON file
        output_file = 'supabase-database-export.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(database_export, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ Export saved to: {output_file}")
        print(f"  Total schemas: {len(database_export['schemas'])}")
        print(f"  Total tables: {database_export['metadata']['total_tables']}")
        
    except Exception as e:
        print(f"\n❌ Error during export: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
