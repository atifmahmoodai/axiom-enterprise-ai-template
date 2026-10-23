import importlib.util
import tempfile
import unittest
from pathlib import Path
import pandas as pd
import numpy as np

spec=importlib.util.spec_from_file_location('axiom_analytics',Path(__file__).with_name('analytics.py'))
analytics=importlib.util.module_from_spec(spec)
spec.loader.exec_module(analytics)

class AnalyticsTests(unittest.TestCase):
 def test_four_formats_roundtrip(self):
  with tempfile.TemporaryDirectory() as folder:
   frame=pd.DataFrame({'region':['Europe','Asia Pacific'],'amount':[10,20]})
   for ext in ['csv','json','xlsx','parquet']:
    path=Path(folder)/('source.'+ext)
    if ext=='csv':frame.to_csv(path,index=False)
    elif ext=='json':frame.to_json(path,orient='records')
    elif ext=='xlsx':frame.to_excel(path,index=False)
    else:frame.to_parquet(path,index=False)
    result=analytics.read_table(path,ext)
    self.assertEqual(len(result),2)
    self.assertEqual(analytics.profile(result)['columns'],2)
 def test_profile_flags_dates_currencies_duplicates_and_formulas(self):
  frame=pd.DataFrame({'date':['01/02/2026']*3,'currency':['USD','EUR','EUR'],'cell':['=HYPERLINK("bad")','ok','ok']})
  result=analytics.profile(frame)
  self.assertEqual(result['duplicates'],1)
  self.assertTrue(any('ambiguous' in w for w in result['warnings']))
  self.assertTrue(any('Mixed currencies' in w for w in result['warnings']))
  self.assertTrue(any('never executed' in w for w in result['warnings']))
 def test_transform_requires_review_for_invalid_numeric_values(self):
  frame=pd.DataFrame({'amount':['10','bad','inf']})
  with self.assertRaises(ValueError):analytics.apply_transforms(frame,[{'type':'cast','column':'amount','to':'number'}])
  result=analytics.apply_transforms(frame,[{'type':'cast','column':'amount','to':'number','invalid':'null'}])
  self.assertEqual(int(result['amount'].isna().sum()),2)
 def test_duplicate_headers_and_arbitrary_expressions_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'bad.csv';p.write_text('a,a\n1,2\n')
   with self.assertRaises(ValueError):analytics.read_table(p,'csv')
  with self.assertRaises(ValueError):analytics.apply_transforms(pd.DataFrame({'a':[1]}),[{'type':'eval','value':'__import__("os")'}])
 def test_cohort_churn_keeps_observed_zero_customers(self):
  snapshots=[{'month':m,'customer_id':c,'mrr':v} for m,values in [('2026-01',[100,100]),('2026-02',[100,0]),('2026-03',[0,0])] for c,v in zip(['a','b'],values)]
  result=analytics.lab({'kind':'cohorts','snapshots':snapshots})
  self.assertEqual([r['retention'] for r in result['rows']],[100,50,0])
 def test_seasonal_forecast_known_pattern_and_history_guard(self):
  series=[{'month':str(m),'revenue':100+(i%12)*10,'cost':20} for i,m in enumerate(pd.period_range('2023-01',periods=36,freq='M'))]
  result=analytics.lab({'kind':'forecast','series':series})
  self.assertEqual(result['statistics']['holdoutOrigins'],6)
  self.assertEqual([round(r['forecast'],4) for r in result['rows']],[100,110,120])
  self.assertEqual(analytics.lab({'kind':'forecast','series':series[:24]})['rows'],[])
 def test_anomalies_and_multiple_comparison_adjustment(self):
  series=[{'month':str(m),'revenue':100+(i%12)*10+(500 if i==25 else 0)} for i,m in enumerate(pd.period_range('2023-01',periods=36,freq='M'))]
  result=analytics.lab({'kind':'anomalies','series':series})
  self.assertTrue(result['rows'][25]['anomaly'])
  np.testing.assert_allclose(analytics.bh_adjust([.01,.04,.03]),[.03,.04,.04])
 def test_scenario_is_explicit_arithmetic(self):
  result=analytics.lab({'kind':'scenario','series':[{'month':'2026-01','revenue':1000,'cost':400}],'options':{'growth':10,'costReduction':25}})
  self.assertEqual(result['rows'][1]['margin'],800)

if __name__=='__main__':unittest.main()
